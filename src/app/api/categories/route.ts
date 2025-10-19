/**
 * CODE INSIGHT
 * This code's use case is to provide a secure API endpoint that returns the current user's categories.
 * This code's full epic context is the Budgets Editor/Overview flows which require a category list; when a user has no categories yet, the endpoint returns a sensible seeded list for initial UI bootstrapping without mutating the database.
 * This code's ui feel is minimal and reliable for a mobile-first PWA: it returns a concise JSON array with optional color/favorite fields, enabling a clean, color-coded UI.
 */

import { NextResponse } from 'next/server'
import { supabaseServer } from '@/utils/supabase/client-server'
import { createHash } from 'node:crypto'

// Soft color palette aligned to primary and accent hues
const PALETTE = [
  '#2563EB', // primary blue
  '#16A34A', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#06B6D4', // cyan
  '#8B5CF6', // violet
  '#10B981', // emerald
  '#F97316', // orange
  '#84CC16', // lime
  '#D946EF', // fuchsia
]

function colorFor(seed: string, fallbackIndex = 0): string {
  const hash = createHash('sha1').update(seed).digest()
  const idx = hash[0] % PALETTE.length
  return PALETTE[idx] ?? PALETTE[fallbackIndex % PALETTE.length]
}

function uuidFromString(input: string): string {
  // Deterministic UUID-like string from SHA-1 (first 16 bytes -> 32 hex chars)
  const hex = createHash('sha1').update(input).digest('hex').slice(0, 32)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

const SEED_CATEGORIES: Array<{ name: string; color?: string; favorite?: boolean }> = [
  { name: '식비', color: '#10B981', favorite: true }, // Food & Dining
  { name: '마트/장보기', color: '#84CC16', favorite: true }, // Groceries
  { name: '교통', color: '#06B6D4', favorite: true }, // Transport
  { name: '주거', color: '#2563EB' }, // Housing
  { name: '공과금', color: '#F59E0B' }, // Utilities
  { name: '엔터테인먼트', color: '#8B5CF6' }, // Entertainment
  { name: '쇼핑', color: '#F97316' }, // Shopping
  { name: '건강/의료', color: '#EF4444' }, // Health
  { name: '교육', color: '#16A34A' }, // Education
  { name: '여행', color: '#D946EF' }, // Travel
  { name: '선물/기부', color: '#06B6D4' }, // Gifts & Charity
  { name: '개인관리', color: '#2563EB' }, // Personal Care
  { name: '기타', color: '#94A3B8' }, // Other (slate-ish)
]

export async function GET() {
  try {
    const {
      data: { user },
      error: authError,
    } = await supabaseServer.auth.getUser()

    if (authError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabaseServer
      .from('categories')
      .select('id, name, is_favorite')
      .eq('user_id', user.id)
      .order('is_favorite', { ascending: false })
      .order('name', { ascending: true })

    if (error) {
      return NextResponse.json({ error: 'Failed to load categories' }, { status: 500 })
    }

    if (data && data.length > 0) {
      const categories = data.map((row) => ({
        id: row.id as string,
        name: row.name as string,
        color: colorFor(`${row.name}:${row.id}`),
        favorite: Boolean(row.is_favorite),
      }))
      return NextResponse.json(categories, { status: 200 })
    }

    // Fallback: return seeded defaults for fresh installs (no DB writes here)
    const seeded = SEED_CATEGORIES.map((c, idx) => ({
      id: uuidFromString(`${user.id}:${c.name}`),
      name: c.name,
      color: c.color ?? colorFor(c.name, idx),
      favorite: Boolean(c.favorite),
    }))

    return NextResponse.json(seeded, { status: 200 })
  } catch (e) {
    return NextResponse.json({ error: 'Unexpected server error' }, { status: 500 })
  }
}
