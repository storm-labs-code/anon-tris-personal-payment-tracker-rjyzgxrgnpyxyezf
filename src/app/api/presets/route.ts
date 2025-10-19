/**
 * CODE INSIGHT
 * This code's use case is to provide a secure presets collection API with RLS-backed Supabase access.
 * This code's full epic context is the Manage Presets flow: listing presets, creating new ones, and ensuring default tags are upserted and related via a junction table. It powers SWR keys like '/api/presets' and supports offline fallbacks on the client.
 * This code's ui feel is not applicable (API route), but responses are structured, typed defensively, and return consistent shapes that the mobile-first UI can trust.
 */

import { NextResponse } from 'next/server'
import { supabaseServer } from '@/utils/supabase/client-server'

function err(status: number, message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status, headers: { 'cache-control': 'no-store' } })
}

function ok(data: unknown, status = 200) {
  return NextResponse.json({ data }, { status, headers: { 'cache-control': 'no-store' } })
}

export async function GET(req: Request) {
  const { data: auth, error: authError } = await supabaseServer.auth.getUser()
  if (authError || !auth?.user) return err(401, 'Unauthorized')

  // Base presets
  const { data: presets, error: presetsError } = await supabaseServer
    .from('presets')
    .select('id, name, amount, category_id, payee, payment_method, notes, is_favorite, created_at, updated_at')
    .order('created_at', { ascending: false })

  if (presetsError) return err(500, 'Failed to load presets', presetsError)

  if (!presets || presets.length === 0) return ok([])

  const presetIds = presets.map((p: any) => p.id)
  const categoryIds = Array.from(new Set(presets.map((p: any) => p.category_id).filter(Boolean)))

  // Categories lookup for joined fields
  let categoriesById: Record<string, any> = {}
  if (categoryIds.length > 0) {
    const { data: categories, error: categoriesError } = await supabaseServer
      .from('categories')
      .select('id, name, is_favorite')
      .in('id', categoryIds)
    if (categoriesError) return err(500, 'Failed to load categories for presets', categoriesError)
    categoriesById = (categories || []).reduce((acc: Record<string, any>, c: any) => {
      acc[c.id] = { id: c.id, name: c.name, is_favorite: c.is_favorite }
      return acc
    }, {})
  }

  // Tags per preset via join table
  const { data: presetTags, error: presetTagsError } = await supabaseServer
    .from('preset_tags')
    .select('preset_id, tags:tag_id ( id, name, is_favorite )')
    .in('preset_id', presetIds)

  if (presetTagsError) return err(500, 'Failed to load preset tags', presetTagsError)

  const tagsByPreset: Record<string, { id: string; name: string; is_favorite: boolean }[]> = {}
  for (const row of presetTags || []) {
    const t = row.tags as any | null
    if (!t) continue
    const list = tagsByPreset[row.preset_id] || []
    list.push({ id: t.id, name: t.name, is_favorite: t.is_favorite })
    tagsByPreset[row.preset_id] = list
  }

  const shaped = presets.map((p: any) => {
    const t = tagsByPreset[p.id] || []
    return {
      id: p.id,
      name: p.name,
      amount: p.amount,
      category_id: p.category_id,
      payee: p.payee,
      payment_method: p.payment_method,
      notes: p.notes,
      is_favorite: p.is_favorite,
      created_at: p.created_at,
      updated_at: p.updated_at,
      category: p.category_id ? categoriesById[p.category_id] || null : null,
      default_tag_names: t.map((x) => x.name),
      default_tag_ids: t.map((x) => x.id),
    }
  })

  return ok(shaped)
}

export async function POST(req: Request) {
  const { data: auth, error: authError } = await supabaseServer.auth.getUser()
  if (authError || !auth?.user) return err(401, 'Unauthorized')

  let body: any
  try {
    body = await req.json()
  } catch {
    return err(400, 'Invalid JSON payload')
  }

  const nameRaw = (body?.name ?? '').toString().trim()
  if (!nameRaw) return err(400, 'Name is required')

  const amountRaw = body?.default_amount ?? body?.amount
  let normalizedAmount: number | null = null
  if (amountRaw !== undefined && amountRaw !== null && amountRaw !== '') {
    const asNum = typeof amountRaw === 'string' ? Number.parseInt(amountRaw, 10) : Number(amountRaw)
    if (!Number.isFinite(asNum) || !Number.isInteger(asNum)) {
      return err(400, 'Amount must be an integer (KRW)')
    }
    normalizedAmount = asNum
  }

  const category_id = body?.category_id ?? null
  const payee = body?.payee ? String(body.payee) : null
  const notes = body?.notes ? String(body.notes) : null
  const defaultTagNames: string[] = Array.isArray(body?.default_tag_names)
    ? Array.from(new Set(
        body.default_tag_names
          .map((x: any) => (x == null ? '' : String(x)))
          .map((s: string) => s.trim())
          .filter((s: string) => s.length > 0)
      ))
    : []

  // Create preset
  const { data: created, error: insertError } = await supabaseServer
    .from('presets')
    .insert({
      user_id: auth.user.id,
      name: nameRaw,
      amount: normalizedAmount,
      category_id: category_id || null,
      payee,
      notes,
    })
    .select('id, name, amount, category_id, payee, payment_method, notes, is_favorite, created_at, updated_at')
    .single()

  if (insertError || !created) {
    const code = (insertError as any)?.code
    if (code === '23503') {
      return err(400, 'Invalid category reference')
    }
    return err(500, 'Failed to create preset', insertError)
  }

  // Upsert tags and link via preset_tags
  let allTags: { id: string; name: string }[] = []
  if (defaultTagNames.length > 0) {
    const { data: existingTags, error: selTagsErr } = await supabaseServer
      .from('tags')
      .select('id, name')
      .in('name', defaultTagNames)

    if (selTagsErr) {
      // cleanup
      await supabaseServer.from('presets').delete().eq('id', created.id)
      return err(500, 'Failed to prepare tags', selTagsErr)
    }

    const existingByName = new Map((existingTags || []).map((t: any) => [t.name, t]))
    const missing = defaultTagNames.filter((n) => !existingByName.has(n))

    let createdTags: { id: string; name: string }[] = []
    if (missing.length > 0) {
      const toInsert = missing.map((n) => ({ user_id: auth.user.id, name: n }))
      const { data: insTags, error: insTagsErr } = await supabaseServer
        .from('tags')
        .insert(toInsert)
        .select('id, name')

      if (insTagsErr) {
        await supabaseServer.from('presets').delete().eq('id', created.id)
        return err(500, 'Failed to create tags', insTagsErr)
      }
      createdTags = (insTags || []) as any
    }

    allTags = [
      ...(((existingTags || []) as any) as { id: string; name: string }[]),
      ...createdTags,
    ]

    if (allTags.length > 0) {
      const joinRows = Array.from(new Map(allTags.map((t) => [t.id, { preset_id: created.id, tag_id: t.id }])).values())
      const { error: joinErr } = await supabaseServer.from('preset_tags').insert(joinRows)
      if (joinErr) {
        await supabaseServer.from('presets').delete().eq('id', created.id)
        return err(500, 'Failed to relate tags to preset', joinErr)
      }
    }
  }

  // Optionally attach category details
  let category: { id: string; name: string; is_favorite: boolean } | null = null
  if (created.category_id) {
    const { data: cat } = await supabaseServer
      .from('categories')
      .select('id, name, is_favorite')
      .eq('id', created.category_id)
      .single()
    if (cat) category = cat as any
  }

  const response = {
    id: created.id,
    name: created.name,
    amount: created.amount,
    category_id: created.category_id,
    payee: created.payee,
    payment_method: created.payment_method,
    notes: created.notes,
    is_favorite: created.is_favorite,
    created_at: created.created_at,
    updated_at: created.updated_at,
    category,
    default_tag_names: allTags.map((t) => t.name),
    default_tag_ids: allTags.map((t) => t.id),
  }

  return ok(response, 201)
}
