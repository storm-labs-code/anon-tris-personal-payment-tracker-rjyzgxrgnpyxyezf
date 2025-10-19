/**
 * CODE INSIGHT
 * This code's use case is to validate a user-uploaded backup ZIP for Tris before restore.
 * This code's full epic context is the Backup & Restore flow: it authenticates the user via Supabase, parses a ZIP in memory, verifies manifest/data integrity, checks schemaVersion support, validates required collections, and returns counts and warnings without writing to the database.
 * This code's ui feel is not applicable (API route), but responses are structured, reliable, and suitable for client toasts and inline summaries.
 */

import { NextResponse } from 'next/server'
import JSZip from 'jszip'
import { supabaseServer } from '@/utils/supabase/client-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function json(data: any, init?: ResponseInit) {
  const headers = new Headers(init?.headers)
  headers.set('Content-Type', 'application/json; charset=utf-8')
  headers.set('Cache-Control', 'no-store')
  return new NextResponse(JSON.stringify(data), { ...init, headers })
}

function isObject(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function coerceArray<T = unknown>(val: any): T[] | undefined {
  if (Array.isArray(val)) return val as T[]
  if (val && typeof val === 'object') return [val as T]
  return undefined
}

function countReceipts(zip: JSZip): number {
  let count = 0
  Object.keys(zip.files).forEach((name) => {
    const entry = zip.files[name]
    // match any path that contains receipts/ subfolder and is a file
    if (/(^|\/)receipts\//i.test(name) && !entry.dir) {
      count += 1
    }
  })
  return count
}

function validateItemsBasic(
  items: any[] | undefined,
  required: Array<string | string[]>,
  sampleCap = 100,
): { invalidCount: number } {
  if (!items || items.length === 0) return { invalidCount: 0 }
  const sample = items.slice(0, sampleCap)
  let invalidCount = 0
  for (const it of sample) {
    if (!isObject(it)) {
      invalidCount++
      continue
    }
    let ok = true
    for (const req of required) {
      if (Array.isArray(req)) {
        // at least one of these must exist and be truthy
        const anyPresent = req.some((k) => Object.prototype.hasOwnProperty.call(it, k) && it[k] !== undefined && it[k] !== null)
        if (!anyPresent) {
          ok = false
          break
        }
      } else {
        if (!Object.prototype.hasOwnProperty.call(it, req) || it[req] === undefined || it[req] === null) {
          ok = false
          break
        }
      }
    }
    if (!ok) invalidCount++
  }
  return { invalidCount }
}

export async function POST(req: Request) {
  try {
    const { data: authData, error: authError } = await supabaseServer.auth.getUser()
    if (authError || !authData?.user) {
      return json({ code: 'UNAUTHORIZED', message: 'Authentication required' }, { status: 401 })
    }

    const form = await req.formData()
    const file = form.get('file')
    if (!file || !(file instanceof File)) {
      return json({ valid: false, errors: ['Missing file field "file"'] }, { status: 400 })
    }

    const buf = Buffer.from(await file.arrayBuffer())
    let zip: JSZip
    try {
      zip = await JSZip.loadAsync(buf)
    } catch (e) {
      return json({ valid: false, errors: ['Uploaded file is not a valid ZIP archive'] }, { status: 400 })
    }

    const manifestEntry = zip.file(/(^|\/)manifest\.json$/i)?.[0]
    const dataEntry = zip.file(/(^|\/)data\.json$/i)?.[0]

    const errors: string[] = []
    const warnings: string[] = []

    if (!manifestEntry) {
      errors.push('manifest.json not found in archive')
    }
    if (!dataEntry) {
      errors.push('data.json not found in archive')
    }

    if (errors.length) {
      return json({ valid: false, errors }, { status: 400 })
    }

    let manifestJson: any
    let dataJson: any
    try {
      const manifestStr = await manifestEntry!.async('string')
      manifestJson = JSON.parse(manifestStr)
    } catch (e) {
      errors.push('manifest.json is not valid JSON')
    }
    try {
      const dataStr = await dataEntry!.async('string')
      dataJson = JSON.parse(dataStr)
    } catch (e) {
      errors.push('data.json is not valid JSON')
    }

    if (errors.length) {
      return json({ valid: false, errors }, { status: 400 })
    }

    // Validate manifest
    const supportedSchemaVersions = [1]
    const schemaVersion = manifestJson?.schemaVersion
    if (typeof schemaVersion !== 'number') {
      errors.push('manifest.schemaVersion must be a number')
    } else if (!supportedSchemaVersions.includes(schemaVersion)) {
      errors.push(`Unsupported schemaVersion: ${schemaVersion}`)
    }

    if (!isObject(dataJson)) {
      errors.push('data.json must contain an object at the top level')
    }

    if (errors.length) {
      return json({ valid: false, errors }, { status: 400 })
    }

    // Collections present check (accept some aliases for forward/backward compatibility)
    const transactions = coerceArray<any>(dataJson.transactions)
    const categories = coerceArray<any>(dataJson.categories)
    const tags = coerceArray<any>(dataJson.tags)
    const presets = coerceArray<any>(dataJson.presets)
    const budgets = coerceArray<any>(dataJson.budgets ?? dataJson.category_budgets)
    const recurring = coerceArray<any>(dataJson.recurring ?? dataJson.recurring_transactions)
    // settings may be array or object; optional for validation
    const settings = coerceArray<any>(dataJson.settings ?? dataJson.user_settings)

    const missingCollections: string[] = []
    if (!transactions) missingCollections.push('transactions')
    if (!categories) missingCollections.push('categories')
    if (!tags) missingCollections.push('tags')
    if (!presets) missingCollections.push('presets')
    if (!budgets) missingCollections.push('budgets')
    if (!recurring) missingCollections.push('recurring')

    if (missingCollections.length) {
      errors.push(`Missing required collections in data.json: ${missingCollections.join(', ')}`)
      return json({ valid: false, errors }, { status: 400 })
    }

    if (!settings) {
      warnings.push('No settings collection found; defaults will be used on restore')
    }

    // Basic field presence validation (sampled)
    const tCheck = validateItemsBasic(transactions, [['occurred_at', 'date'], 'amount'])
    if (tCheck.invalidCount > 0) warnings.push(`${tCheck.invalidCount} transaction item(s) missing required fields (amount and occurred_at/date) in sample`)

    const cCheck = validateItemsBasic(categories, ['name'])
    if (cCheck.invalidCount > 0) warnings.push(`${cCheck.invalidCount} category item(s) missing required field: name in sample`)

    const tagCheck = validateItemsBasic(tags, ['name'])
    if (tagCheck.invalidCount > 0) warnings.push(`${tagCheck.invalidCount} tag item(s) missing required field: name in sample`)

    const pCheck = validateItemsBasic(presets, ['name'])
    if (pCheck.invalidCount > 0) warnings.push(`${pCheck.invalidCount} preset item(s) missing required field: name in sample`)

    const bCheck = validateItemsBasic(budgets, [['period_start', 'month'], 'amount'])
    if (bCheck.invalidCount > 0) warnings.push(`${bCheck.invalidCount} budget item(s) missing required fields (amount and period_start/month) in sample`)

    const rCheck = validateItemsBasic(recurring, ['amount', 'frequency', ['start_date', 'start']])
    if (rCheck.invalidCount > 0) warnings.push(`${rCheck.invalidCount} recurring item(s) missing required fields (amount, frequency, and start_date) in sample`)

    const receiptsCount = countReceipts(zip)
    if (receiptsCount > 0 && (transactions?.length ?? 0) === 0) {
      warnings.push('Archive includes receipts but has no transactions')
    }

    const counts = {
      transactions: transactions?.length ?? 0,
      categories: categories?.length ?? 0,
      tags: tags?.length ?? 0,
      presets: presets?.length ?? 0,
      budgets: budgets?.length ?? 0,
      recurring: recurring?.length ?? 0,
      receipts: receiptsCount,
    }

    return json({ valid: true, schemaVersion, counts, warnings }, { status: 200 })
  } catch (err) {
    return json(
      {
        valid: false,
        errors: ['Unexpected server error while validating backup'],
      },
      { status: 500 },
    )
  }
}
