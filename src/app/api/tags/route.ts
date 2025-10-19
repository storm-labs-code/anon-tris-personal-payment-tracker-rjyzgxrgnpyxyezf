/**
 * CODE INSIGHT
 * This code's use case is to provide the Tags collection API for Tris, enabling listing and creation of user-scoped tags with search support.
 * This code's full epic context is the Manage > Tags flow and tag suggestion inputs across the app, with offline fallbacks handled client-side.
 * This code's ui feel is not applicable (API route), but responses are consistent, minimal, and reliable to support a calm, trustworthy UX.
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/utils/supabase/client-server'

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export async function GET(request: NextRequest) {
  const { data: auth, error: authError } = await supabaseServer.auth.getUser()
  if (authError || !auth?.user) return unauthorized()

  const url = new URL(request.url)
  const search = url.searchParams.get('search')?.trim() ?? ''

  let query = supabaseServer
    .from('tags')
    .select('id,name,is_favorite,created_at,updated_at')

  if (search.length > 0) {
    query = query.ilike('name', `${search}%`).limit(20)
  }

  const { data, error } = await query.order('name', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest) {
  const { data: auth, error: authError } = await supabaseServer.auth.getUser()
  if (authError || !auth?.user) return unauthorized()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const rawName = typeof (body as any)?.name === 'string' ? (body as any).name : ''
  const normalized = rawName.replace(/\s+/g, ' ').trim().toLowerCase()

  if (!normalized) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }
  if (normalized.length > 64) {
    return NextResponse.json({ error: 'Name is too long (max 64 characters)' }, { status: 400 })
  }

  // Check for existing tag (unique per user by normalized name)
  const { data: existing, error: existErr } = await supabaseServer
    .from('tags')
    .select('id,name,is_favorite,created_at,updated_at')
    .eq('name', normalized)
    .maybeSingle()

  if (existErr && existErr.code !== 'PGRST116') {
    // Unexpected error other than no rows
    return NextResponse.json({ error: existErr.message }, { status: 500 })
  }

  if (existing) {
    return NextResponse.json(
      { error: 'Tag already exists', existing },
      { status: 409 }
    )
  }

  const { data, error } = await supabaseServer
    .from('tags')
    .insert({ user_id: auth.user.id, name: normalized })
    .select('id,name,is_favorite,created_at,updated_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
