/**
 * CODE INSIGHT
 * This code's use case is to provide a secure, user-scoped API for retrieving, updating, and deleting a single category by id.
 * This code's full epic context is the Categories management flow within Tris, ensuring RLS-scoped access via Supabase and handling preset references on delete with 409 responses.
 * This code's ui feel is not applicable (API route), but responses are concise, predictable JSON with proper HTTP status codes to support a calm, reliable client UX.
 */

import { NextResponse } from 'next/server'
import { supabaseServer } from '@/utils/supabase/client-server'

function isValidUUID(v: string) {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(v)
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { data: authData, error: authError } = await supabaseServer.auth.getUser()
  if (authError || !authData?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const id = params.id
  if (!isValidUUID(id)) {
    return NextResponse.json({ error: 'Invalid category id' }, { status: 400 })
  }

  const { data, error } = await supabaseServer
    .from('categories')
    .select('id, name, is_favorite, created_at, updated_at')
    .eq('id', id)
    .single()

  if (error) {
    if ((error as any)?.code === 'PGRST116') {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 })
  }

  return NextResponse.json(data, { status: 200 })
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { data: authData, error: authError } = await supabaseServer.auth.getUser()
  if (authError || !authData?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const id = params.id
  if (!isValidUUID(id)) {
    return NextResponse.json({ error: 'Invalid category id' }, { status: 400 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const update: Record<string, any> = {}
  if (typeof body?.name === 'string') {
    const trimmed = body.name.trim()
    if (trimmed.length === 0) {
      return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })
    }
    update.name = trimmed
  }
  if (typeof body?.is_favorite === 'boolean') {
    update.is_favorite = body.is_favorite
  }
  // icon and color are not part of the current schema; safely ignore if provided

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { data, error } = await supabaseServer
    .from('categories')
    .update(update)
    .eq('id', id)
    .select('id, name, is_favorite, created_at, updated_at')
    .single()

  if (error) {
    if ((error as any)?.code === 'PGRST116') {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 })
  }

  return NextResponse.json(data, { status: 200 })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { data: authData, error: authError } = await supabaseServer.auth.getUser()
  if (authError || !authData?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const id = params.id
  if (!isValidUUID(id)) {
    return NextResponse.json({ error: 'Invalid category id' }, { status: 400 })
  }

  // Prevent deletion when referenced by presets
  const { count, error: refError } = await supabaseServer
    .from('presets')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', id)

  if (refError) {
    return NextResponse.json({ error: refError.message }, { status: 500 })
  }

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: 'Category cannot be deleted because it is referenced by one or more presets.' },
      { status: 409 }
    )
  }

  const { data, error } = await supabaseServer
    .from('categories')
    .delete()
    .eq('id', id)
    .select('id')
    .single()

  if (error) {
    // Handle foreign key violations from other tables (transactions, budgets, etc.)
    if ((error as any)?.code === '23503') {
      return NextResponse.json(
        { error: 'Category cannot be deleted because it is referenced by other records.' },
        { status: 409 }
      )
    }
    if ((error as any)?.code === 'PGRST116') {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 })
  }

  return new NextResponse(null, { status: 204 })
}
