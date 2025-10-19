/**
 * CODE INSIGHT
 * This code's use case is to provide a secure, user-scoped API for single Tag operations (read, rename, delete) in the Tris app.
 * This code's full epic context is the Manage > Tags feature where users manage tags with offline support and server persistence via Supabase. The route enforces RLS, handles conflicts, and returns appropriate HTTP statuses used by SWR on the client.
 * This code's ui feel is not applicable (API route), but responses are clear and actionable, supporting optimistic UI and friendly error messaging.
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/utils/supabase/client-server'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { data: auth, error: authError } = await supabaseServer.auth.getUser()
  if (authError || !auth?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error, status } = await supabaseServer
    .from('tags')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error) {
    if (status === 406 || error.message?.toLowerCase().includes('no rows')) {
      return NextResponse.json({ error: 'Not Found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Failed to fetch tag', details: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 200 })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { data: auth, error: authError } = await supabaseServer.auth.getUser()
  if (authError || !auth?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const name = typeof (body as any)?.name === 'string' ? (body as any).name.trim() : ''
  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }
  if (name.length > 64) {
    return NextResponse.json({ error: 'Name must be 64 characters or fewer' }, { status: 400 })
  }

  // Check for duplicate name within the same user (case-insensitive)
  const { count: dupCount, error: dupError } = await supabaseServer
    .from('tags')
    .select('id', { count: 'exact', head: true })
    .ilike('name', name)
    .neq('id', params.id)

  if (dupError) {
    return NextResponse.json({ error: 'Failed to validate uniqueness', details: dupError.message }, { status: 500 })
  }
  if ((dupCount ?? 0) > 0) {
    return NextResponse.json({ error: 'Tag with the same name already exists' }, { status: 409 })
  }

  const { data, error } = await supabaseServer
    .from('tags')
    .update({ name, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single()

  if (error) {
    // If RLS prevented update or row missing, signal not found.
    if (error.code === 'PGRST116' || error.message?.toLowerCase().includes('no rows')) {
      return NextResponse.json({ error: 'Not Found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Failed to update tag', details: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 200 })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { data: auth, error: authError } = await supabaseServer.auth.getUser()
  if (authError || !auth?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if tag is referenced by any transactions or presets
  const [{ count: txCount, error: txErr }, { count: prCount, error: prErr }] = await Promise.all([
    supabaseServer
      .from('transaction_tags')
      .select('transaction_id', { count: 'exact', head: true })
      .eq('tag_id', params.id),
    supabaseServer
      .from('preset_tags')
      .select('preset_id', { count: 'exact', head: true })
      .eq('tag_id', params.id),
  ])

  if (txErr || prErr) {
    const detail = txErr?.message || prErr?.message || 'Unknown error'
    return NextResponse.json({ error: 'Failed to check tag usage', details: detail }, { status: 500 })
  }

  const tCount = txCount ?? 0
  const pCount = prCount ?? 0
  if (tCount > 0 || pCount > 0) {
    const parts: string[] = []
    if (tCount > 0) parts.push(`${tCount} transaction${tCount === 1 ? '' : 's'}`)
    if (pCount > 0) parts.push(`${pCount} preset${pCount === 1 ? '' : 's'}`)
    return NextResponse.json(
      { error: 'Tag is in use', details: `Cannot delete tag because it is linked to ${parts.join(' and ')}.` },
      { status: 409 }
    )
  }

  const { error } = await supabaseServer.from('tags').delete().eq('id', params.id)

  if (error) {
    // Foreign key violation or RLS
    if (error.code === '23503') {
      return NextResponse.json({ error: 'Tag is in use and cannot be deleted' }, { status: 409 })
    }
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Not Found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Failed to delete tag', details: error.message }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
