/**
 * CODE INSIGHT
 * This code's use case is to restore a user's backup archive (.zip) into Supabase.
 * This code's full epic context is the Backup & Restore feature for Tris, enabling users to import data and receipts with merge or replace modes.
 * This code's ui feel is not applicable (API route), but it emphasizes reliability, scoping to authenticated user, and robust JSON responses for client toasts and redirects.
 */

import JSZip from 'jszip'
import { NextRequest } from 'next/server'
import { supabaseServer } from '@/utils/supabase/client-server'
import { supabaseAdmin } from '@/utils/supabase/client-admin'

export const runtime = 'nodejs'

// Helpers
const CHUNK_SIZE = 500

function chunkArray<T>(arr: T[], size = CHUNK_SIZE): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size))
  return chunks
}

function extToMime(name: string): string {
  const lower = name.toLowerCase()
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.heic')) return 'image/heic'
  if (lower.endsWith('.heif')) return 'image/heif'
  if (lower.endsWith('.pdf')) return 'application/pdf'
  return 'application/octet-stream'
}

function baseName(path: string): string {
  return path.replace(/\\/g, '/').split('/').filter(Boolean).pop() || path
}

function safeUUID(): string {
  // crypto.randomUUID is available in Node 18+
  return (globalThis as any).crypto?.randomUUID ? (globalThis as any).crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function jsonResponse(body: any, init?: ResponseInit) {
  const headers = new Headers(init?.headers)
  headers.set('Cache-Control', 'no-store')
  headers.set('Content-Type', 'application/json')
  return new Response(JSON.stringify(body), { ...init, headers })
}

// Types for parsed backup
type DataJson = {
  categories?: any[]
  tags?: any[]
  presets?: any[]
  transactions?: any[]
  recurring?: any[]
  budgets?: any[]
  settings?: any[] | any // could be an array or single object
  transaction_tags?: { transaction_id: string; tag_id: string }[]
  preset_tags?: { preset_id: string; tag_id: string }[]
  transaction_receipts?: { id?: string; transaction_id: string; url?: string; path?: string; content_type?: string }[]
}

async function listUserReceiptPaths(userId: string): Promise<string[]> {
  const bucket = 'receipts'
  const collected: string[] = []
  let offset = 0
  const limit = 1000

  while (true) {
    const { data, error } = await supabaseAdmin.storage.from(bucket).list(userId, {
      limit,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    })
    if (error) throw new Error(`Storage list error: ${error.message}`)
    if (!data || data.length === 0) break

    // Only files in this folder level; nested folders are not handled here
    for (const obj of data) {
      // When Storage returns directories, they are typically not present as files; we conservatively treat all names as files here
      if (obj.name) collected.push(`${userId}/${obj.name}`)
    }

    if (data.length < limit) break
    offset += limit
  }

  return collected
}

function toArray<T>(v: T | T[] | undefined | null): T[] {
  if (!v) return []
  return Array.isArray(v) ? v : [v]
}

function normalizeSettings(userId: string, settings: any | any[]): any[] {
  const arr = toArray(settings)
  if (arr.length === 0) return []
  return arr.map((s: any) => ({
    id: s.id || safeUUID(),
    user_id: userId,
    primary_currency: s.primary_currency ?? s.currency ?? 'KRW',
    time_zone: s.time_zone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'Asia/Seoul',
    theme: s.theme ?? 'system',
    notifications_enabled: typeof s.notifications_enabled === 'boolean' ? s.notifications_enabled : true,
    created_at: s.created_at,
    updated_at: s.updated_at,
  }))
}

function sanitizeCategory(userId: string, c: any) {
  return {
    id: c.id || safeUUID(),
    user_id: userId,
    name: c.name,
    is_favorite: !!c.is_favorite,
    created_at: c.created_at,
    updated_at: c.updated_at,
  }
}

function sanitizeTag(userId: string, t: any) {
  return {
    id: t.id || safeUUID(),
    user_id: userId,
    name: t.name,
    is_favorite: !!t.is_favorite,
    created_at: t.created_at,
    updated_at: t.updated_at,
  }
}

function sanitizePreset(userId: string, p: any) {
  return {
    id: p.id || safeUUID(),
    user_id: userId,
    name: p.name,
    amount: p.amount ?? null,
    category_id: p.category_id ?? null,
    payee: p.payee ?? null,
    payment_method: p.payment_method ?? null,
    notes: p.notes ?? null,
    is_favorite: !!p.is_favorite,
    created_at: p.created_at,
    updated_at: p.updated_at,
  }
}

function sanitizeTransaction(userId: string, t: any) {
  return {
    id: t.id || safeUUID(),
    user_id: userId,
    amount: t.amount,
    occurred_at: t.occurred_at ?? t.date ?? t.datetime,
    category_id: t.category_id ?? null,
    payee: t.payee ?? null,
    payment_method: t.payment_method,
    notes: t.notes ?? null,
    created_at: t.created_at,
    updated_at: t.updated_at,
  }
}

function sanitizeRecurring(userId: string, r: any) {
  return {
    id: r.id || safeUUID(),
    user_id: userId,
    amount: r.amount,
    category_id: r.category_id ?? null,
    payee: r.payee ?? null,
    payment_method: r.payment_method,
    notes: r.notes ?? null,
    frequency: r.frequency,
    interval: r.interval ?? 1,
    start_date: r.start_date,
    end_date: r.end_date ?? null,
    is_active: typeof r.is_active === 'boolean' ? r.is_active : true,
    reminder_enabled: typeof r.reminder_enabled === 'boolean' ? r.reminder_enabled : false,
    reminder_time: r.reminder_time ?? null,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }
}

function sanitizeBudget(userId: string, b: any) {
  return {
    id: b.id || safeUUID(),
    user_id: userId,
    category_id: b.category_id,
    period_start: b.period_start,
    amount: b.amount,
    alert_threshold_percent: b.alert_threshold_percent ?? 80,
    created_at: b.created_at,
    updated_at: b.updated_at,
  }
}

async function upsertWithSelect<T extends Record<string, any>>(table: string, rows: T[]): Promise<number> {
  if (rows.length === 0) return 0
  let total = 0
  for (const part of chunkArray(rows)) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .upsert(part, { onConflict: 'id' })
      .select('id')
    if (error) throw new Error(`${table} upsert failed: ${error.message}`)
    total += data?.length || 0
  }
  return total
}

async function insertWithSelect<T extends Record<string, any>>(table: string, rows: T[]): Promise<number> {
  if (rows.length === 0) return 0
  let total = 0
  for (const part of chunkArray(rows)) {
    const { data, error } = await supabaseAdmin.from(table).insert(part).select('*')
    if (error) throw new Error(`${table} insert failed: ${error.message}`)
    total += data?.length || 0
  }
  return total
}

export async function POST(req: NextRequest) {
  try {
    const { data: userRes, error: userErr } = await supabaseServer.auth.getUser()
    if (userErr || !userRes?.user) {
      return jsonResponse({ ok: false, code: 'UNAUTHORIZED', message: 'User not authenticated' }, { status: 401 })
    }
    const userId = userRes.user.id

    const form = await req.formData()
    const file = form.get('file') as File | null
    const mergeMode = String(form.get('mergeMode') || 'merge') as 'merge' | 'replace'

    if (!file || !(file instanceof File)) {
      return jsonResponse({ ok: false, code: 'BAD_REQUEST', message: 'Missing file' }, { status: 400 })
    }
    if (!['merge', 'replace'].includes(mergeMode)) {
      return jsonResponse({ ok: false, code: 'BAD_REQUEST', message: 'Invalid mergeMode. Expected merge|replace' }, { status: 400 })
    }

    const ab = await file.arrayBuffer()
    const zip = await JSZip.loadAsync(ab)

    const manifestEntry = zip.file('manifest.json')
    const dataEntry = zip.file('data.json')
    if (!dataEntry) {
      return jsonResponse({ ok: false, code: 'VALIDATION_FAILED', message: 'data.json missing from archive' }, { status: 400 })
    }

    const manifest = manifestEntry ? JSON.parse(await manifestEntry.async('string')) : null
    if (manifest && manifest.schemaVersion && Number(manifest.schemaVersion) > 1) {
      return jsonResponse({ ok: false, code: 'UNSUPPORTED_VERSION', message: `Unsupported schemaVersion ${manifest.schemaVersion}` }, { status: 400 })
    }

    const dataJson: DataJson = JSON.parse(await dataEntry.async('string'))

    // Normalize collections
    const categories = (dataJson.categories || []).map((c) => sanitizeCategory(userId, c)).filter((c) => !!c.name)
    const tags = (dataJson.tags || []).map((t) => sanitizeTag(userId, t)).filter((t) => !!t.name)
    const presets = (dataJson.presets || []).map((p) => sanitizePreset(userId, p)).filter((p) => !!p.name)
    const transactions = (dataJson.transactions || []).map((t) => sanitizeTransaction(userId, t)).filter((t) => !!t.amount && !!t.occurred_at && !!t.payment_method)
    const recurring = (dataJson.recurring || []).map((r) => sanitizeRecurring(userId, r)).filter((r) => !!r.amount && !!r.frequency && !!r.start_date && !!r.payment_method)
    const budgets = (dataJson.budgets || []).map((b) => sanitizeBudget(userId, b)).filter((b) => !!b.category_id && !!b.period_start && !!b.amount)
    const settings = normalizeSettings(userId, dataJson.settings)

    const transactionTags = toArray(dataJson.transaction_tags)
      .filter((tt) => tt && tt.transaction_id && tt.tag_id)
    const presetTags = toArray(dataJson.preset_tags)
      .filter((pt) => pt && pt.preset_id && pt.tag_id)

    // Receipt files in zip
    const receiptsFolder = zip.folder('receipts')
    const receiptFiles: { relPath: string; name: string; content: Uint8Array; mime: string }[] = []
    if (receiptsFolder) {
      const files = Object.values(receiptsFolder.files)
      for (const f of files) {
        if (f.dir) continue
        const rel = f.name.replace(/^receipts\//, '')
        const content = await f.async('uint8array')
        receiptFiles.push({ relPath: rel, name: baseName(rel), content, mime: extToMime(rel) })
      }
    }

    // If replace, clear existing data and receipts for user
    if (mergeMode === 'replace') {
      // Gather ids for child table deletions
      const txIds: string[] = []
      const presetIds: string[] = []

      // Fetch all transaction ids for user
      {
        let from = 0
        const step = 1000
        while (true) {
          const { data: ids, error } = await supabaseAdmin
            .from('transactions')
            .select('id')
            .eq('user_id', userId)
            .range(from, from + step - 1)
          if (error) throw new Error(`Fetch transaction ids failed: ${error.message}`)
          if (!ids || ids.length === 0) break
          txIds.push(...ids.map((r: any) => r.id))
          if (ids.length < step) break
          from += step
        }
      }
      // Fetch all preset ids for user
      {
        let from = 0
        const step = 1000
        while (true) {
          const { data: ids, error } = await supabaseAdmin
            .from('presets')
            .select('id')
            .eq('user_id', userId)
            .range(from, from + step - 1)
          if (error) throw new Error(`Fetch preset ids failed: ${error.message}`)
          if (!ids || ids.length === 0) break
          presetIds.push(...ids.map((r: any) => r.id))
          if (ids.length < step) break
          from += step
        }
      }

      if (txIds.length) {
        const { error: e1 } = await supabaseAdmin.from('transaction_receipts').delete().in('transaction_id', txIds)
        if (e1) throw new Error(`Delete transaction_receipts failed: ${e1.message}`)
        const { error: e2 } = await supabaseAdmin.from('transaction_tags').delete().in('transaction_id', txIds)
        if (e2) throw new Error(`Delete transaction_tags failed: ${e2.message}`)
      }

      if (presetIds.length) {
        const { error: e3 } = await supabaseAdmin.from('preset_tags').delete().in('preset_id', presetIds)
        if (e3) throw new Error(`Delete preset_tags failed: ${e3.message}`)
      }

      // Delete simple user-scoped tables
      const delOrder = [
        { table: 'category_budgets', col: 'user_id' },
        { table: 'recurring_transactions', col: 'user_id' },
        { table: 'transactions', col: 'user_id' },
        { table: 'presets', col: 'user_id' },
        { table: 'tags', col: 'user_id' },
        { table: 'categories', col: 'user_id' },
      ] as const
      for (const d of delOrder) {
        const { error } = await supabaseAdmin.from(d.table).delete().eq(d.col, userId)
        if (error) throw new Error(`Delete from ${d.table} failed: ${error.message}`)
      }

      // Remove storage files under receipts/{userId}/ (flat level)
      try {
        const existing = await listUserReceiptPaths(userId)
        if (existing.length) {
          const { error: remErr } = await supabaseAdmin.storage.from('receipts').remove(existing)
          if (remErr) throw remErr
        }
      } catch (e: any) {
        // Non-fatal for restore
        console.warn('Storage cleanup warning:', e?.message || e)
      }
    }

    // Upsert base dimension tables first
    const imported = {
      categories: 0,
      tags: 0,
      presets: 0,
      transactions: 0,
      recurring: 0,
      budgets: 0,
      receipts: 0,
    }

    imported.categories = await upsertWithSelect('categories', categories)
    imported.tags = await upsertWithSelect('tags', tags)

    // Fact tables
    imported.presets = await upsertWithSelect('presets', presets)
    imported.transactions = await upsertWithSelect('transactions', transactions)
    imported.recurring = await upsertWithSelect('recurring_transactions', recurring)
    imported.budgets = await upsertWithSelect('category_budgets', budgets)

    // Join tables handling: prevent duplicates by clearing for imported ids
    if (presetTags.length) {
      const presetIdsToReplace = Array.from(new Set(presetTags.map((p) => p.preset_id)))
      const { error: delPT } = await supabaseAdmin.from('preset_tags').delete().in('preset_id', presetIdsToReplace)
      if (delPT) throw new Error(`Delete existing preset_tags failed: ${delPT.message}`)
      await insertWithSelect('preset_tags', presetTags.map((pt) => ({ preset_id: pt.preset_id, tag_id: pt.tag_id })))
    }

    if (transactionTags.length) {
      const txIdsToReplace = Array.from(new Set(transactionTags.map((t) => t.transaction_id)))
      const { error: delTT } = await supabaseAdmin.from('transaction_tags').delete().in('transaction_id', txIdsToReplace)
      if (delTT) throw new Error(`Delete existing transaction_tags failed: ${delTT.message}`)
      await insertWithSelect('transaction_tags', transactionTags.map((tt) => ({ transaction_id: tt.transaction_id, tag_id: tt.tag_id })))
    }

    // Upload receipts and create transaction_receipts
    const uploadedPathByOriginal: Record<string, string> = {}
    for (const rf of receiptFiles) {
      const targetPath = `${userId}/${rf.name}`
      const { error: upErr } = await supabaseAdmin.storage
        .from('receipts')
        .upload(targetPath, rf.content, { contentType: rf.mime, upsert: true })
      if (upErr) throw new Error(`Upload receipt ${rf.name} failed: ${upErr.message}`)
      uploadedPathByOriginal[rf.relPath] = targetPath
      uploadedPathByOriginal[rf.name] = targetPath
    }

    const dataReceipts = toArray(dataJson.transaction_receipts)
    const receiptRows: { transaction_id: string; url: string; content_type?: string }[] = []

    if (dataReceipts.length) {
      for (const r of dataReceipts) {
        const orig = (r.path || r.url || '').toString().replace(/^https?:\/\/[^/]+\//, '')
        const bn = baseName(orig)
        const mappedPath = uploadedPathByOriginal[orig] || uploadedPathByOriginal[bn]
        if (!mappedPath) continue
        receiptRows.push({ transaction_id: r.transaction_id, url: mappedPath, content_type: r.content_type || extToMime(mappedPath) })
      }
    } else {
      // Fallback: old style receipt_path on transactions
      for (const t of dataJson.transactions || []) {
        const path = t.receipt_path || t.receipt || t.receipt_url
        if (!path) continue
        const bn = baseName(String(path))
        const mappedPath = uploadedPathByOriginal[String(path)] || uploadedPathByOriginal[bn]
        if (!mappedPath) continue
        const txId = t.id
        if (!txId) continue
        receiptRows.push({ transaction_id: txId, url: mappedPath, content_type: extToMime(mappedPath) })
      }
    }

    if (receiptRows.length) {
      imported.receipts = await insertWithSelect('transaction_receipts', receiptRows)
    }

    // Settings upsert (single row per user typically)
    if (settings.length) {
      await upsertWithSelect('user_settings', settings)
    }

    return jsonResponse({
      ok: true,
      mode: mergeMode,
      imported,
    })
  } catch (err: any) {
    const message = err?.message || 'Unexpected error'
    return jsonResponse({ ok: false, code: 'INTERNAL_ERROR', message }, { status: 500 })
  }
}
