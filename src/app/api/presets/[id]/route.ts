/**
 * CODE INSIGHT
 * This code's use case is to handle single Preset CRUD operations for Tris via API route handlers.
 * This code's full epic context is the Presets management flow where users can fetch, update, and delete presets,
 * including ensuring default tags exist and replacing preset-tag associations. All operations are scoped to the
 * authenticated user via Supabase RLS.
 * This code's ui feel is not applicable (API), but responses are structured, secure, and predictable to power
 * a calm, confident, mobile-first client experience with clear error handling.
 */

import { NextResponse } from 'next/server'
import { supabaseServer } from '@/utils/supabase/client-server'

async function requireUser() {
  const { data, error } = await supabaseServer.auth.getUser()
  if (error || !data?.user) {
    return { user: null as null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  return { user: data.user, error: null as null }
}

async function fetchPresetWithExtras(userId: string, presetId: string) {
  const { data: preset, error: presetErr } = await supabaseServer
    .from('presets')
    .select(
      [
        'id',
        'user_id',
        'name',
        'amount',
        'category_id',
        'payee',
        'payment_method',
        'notes',
        'is_favorite',
        'created_at',
        'updated_at',
      ].join(', ')
    )
    .eq('id', presetId)
    .eq('user_id', userId)
    .single()

  if (presetErr || !preset) {
    return { error: NextResponse.json({ error: 'Preset not found' }, { status: 404 }) }
  }

  let category: any = null
  if (preset.category_id) {
    const { data: cat } = await supabaseServer
      .from('categories')
      .select('id, name, is_favorite')
      .eq('id', preset.category_id)
      .eq('user_id', userId)
      .single()
    if (cat) category = cat
  }

  const { data: tagRows, error: tagErr } = await supabaseServer
    .from('preset_tags')
    .select('tags(name)')
    .eq('preset_id', presetId)

  if (tagErr) {
    return { error: NextResponse.json({ error: 'Failed to load preset tags' }, { status: 500 }) }
  }

  const default_tag_names = (tagRows || [])
    .map((r: any) => r?.tags?.name)
    .filter((n: any) => typeof n === 'string')

  return { data: { ...preset, category, default_tag_names } }
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const { user, error } = await requireUser()
    if (!user) return error!

    const result = await fetchPresetWithExtras(user.id, params.id)
    if ('error' in result) return result.error

    return NextResponse.json(result.data)
  } catch (e: any) {
    return NextResponse.json({ error: 'Unexpected server error', detail: String(e?.message || e) }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const { user, error } = await requireUser()
    if (!user) return error!

    const body = await req.json().catch(() => ({}))

    const {
      name,
      amount,
      category_id,
      payee,
      payment_method,
      notes,
      is_favorite,
      default_tag_names,
      // ignore any other unexpected fields
    } = body || {}

    const updateFields: Record<string, any> = {}
    if (typeof name !== 'undefined') updateFields.name = name
    if (typeof amount !== 'undefined') updateFields.amount = amount
    if (typeof category_id !== 'undefined') updateFields.category_id = category_id
    if (typeof payee !== 'undefined') updateFields.payee = payee
    if (typeof payment_method !== 'undefined') updateFields.payment_method = payment_method
    if (typeof notes !== 'undefined') updateFields.notes = notes
    if (typeof is_favorite !== 'undefined') updateFields.is_favorite = !!is_favorite

    // Ensure preset exists and belongs to user before any mutation
    const { data: existing, error: existingErr } = await supabaseServer
      .from('presets')
      .select('id')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (existingErr || !existing) {
      return NextResponse.json({ error: 'Preset not found' }, { status: 404 })
    }

    if (Object.keys(updateFields).length > 0) {
      const { error: updErr } = await supabaseServer
        .from('presets')
        .update(updateFields)
        .eq('id', params.id)
        .eq('user_id', user.id)

      if (updErr) {
        return NextResponse.json({ error: 'Failed to update preset', detail: updErr.message }, { status: 400 })
      }
    }

    if (Array.isArray(default_tag_names)) {
      // Normalize names: trim, dedupe, non-empty
      const normalized = Array.from(
        new Set(
          default_tag_names
            .filter((n: any) => typeof n === 'string')
            .map((n: string) => n.trim())
            .filter((n: string) => n.length > 0)
        )
      )

      // Fetch existing tags for these names
      let existingTags: { id: string; name: string }[] = []
      if (normalized.length > 0) {
        const { data: et, error: etErr } = await supabaseServer
          .from('tags')
          .select('id, name')
          .in('name', normalized)
          .eq('user_id', user.id)

        if (etErr) {
          return NextResponse.json({ error: 'Failed to read existing tags', detail: etErr.message }, { status: 500 })
        }
        existingTags = et || []
      }

      const existingNames = new Set(existingTags.map((t) => t.name))
      const missingNames = normalized.filter((n) => !existingNames.has(n))

      let newTags: { id: string; name: string }[] = []
      if (missingNames.length > 0) {
        const { data: inserted, error: insErr } = await supabaseServer
          .from('tags')
          .insert(missingNames.map((n) => ({ name: n, user_id: user.id })))
          .select('id, name')

        if (insErr) {
          return NextResponse.json({ error: 'Failed to create tags', detail: insErr.message }, { status: 500 })
        }
        newTags = inserted || []
      }

      const allTagIds = [...existingTags, ...newTags].map((t) => t.id)

      // Replace preset_tags
      const { error: delErr } = await supabaseServer
        .from('preset_tags')
        .delete()
        .eq('preset_id', params.id)

      if (delErr) {
        return NextResponse.json({ error: 'Failed to reset preset tags', detail: delErr.message }, { status: 500 })
      }

      if (allTagIds.length > 0) {
        const { error: linkErr } = await supabaseServer
          .from('preset_tags')
          .insert(allTagIds.map((tagId) => ({ preset_id: params.id, tag_id: tagId })))

        if (linkErr) {
          return NextResponse.json({ error: 'Failed to link preset tags', detail: linkErr.message }, { status: 500 })
        }
      }
    }

    const result = await fetchPresetWithExtras(user.id, params.id)
    if ('error' in result) return result.error

    return NextResponse.json(result.data)
  } catch (e: any) {
    return NextResponse.json({ error: 'Unexpected server error', detail: String(e?.message || e) }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const { user, error } = await requireUser()
    if (!user) return error!

    // Ensure preset exists and belongs to user
    const { data: preset, error: findErr } = await supabaseServer
      .from('presets')
      .select('id')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (findErr || !preset) {
      return NextResponse.json({ error: 'Preset not found' }, { status: 404 })
    }

    // Clean up join table first
    const { error: delLinksErr } = await supabaseServer
      .from('preset_tags')
      .delete()
      .eq('preset_id', params.id)

    if (delLinksErr) {
      return NextResponse.json({ error: 'Failed to remove preset tag links', detail: delLinksErr.message }, { status: 500 })
    }

    const { error: delPresetErr } = await supabaseServer
      .from('presets')
      .delete()
      .eq('id', params.id)
      .eq('user_id', user.id)

    if (delPresetErr) {
      return NextResponse.json({ error: 'Failed to delete preset', detail: delPresetErr.message }, { status: 500 })
    }

    return new NextResponse(null, { status: 204 })
  } catch (e: any) {
    return NextResponse.json({ error: 'Unexpected server error', detail: String(e?.message || e) }, { status: 500 })
  }
}
