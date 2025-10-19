/**
 * CODE INSIGHT
 * This code's use case is to generate a downloadable ZIP archive of all receipt images for the authenticated user,
 * optionally filtered by a start/end date range, pulled from Supabase Storage and streamed to the client.
 * This code's full epic context is the Backup & Export flows where users can export receipts via /api/export/receipts.
 * This code's ui feel is not applicable (API route), but responses are optimized for PWA downloads with proper headers.
 */

import { NextResponse } from 'next/server'
import { supabaseServer } from '@/utils/supabase/client-server'
import archiver from 'archiver'
import { PassThrough, Readable } from 'node:stream'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isISODateOnly(value: string | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function endOfDayUTC(dateStr: string): string {
  // Treat the provided date as UTC date-only
  return `${dateStr}T23:59:59.999Z`
}

function startOfDayUTC(dateStr: string): string {
  return `${dateStr}T00:00:00.000Z`
}

function formatDateForFilename(dateStr: string | null): string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return 'all'
  return dateStr.replace(/-/g, '')
}

function sanitizePath(p: string): string {
  // Normalize various possible url/path shapes to a bucket-relative safe path
  let path = p.trim()
  // If public URL form, strip known prefix to object key
  path = path.replace(
    /^https?:\/\/[^/]+\/storage\/v1\/object\/(?:public|signed)\/receipts\//,
    ''
  )
  // Remove repeated bucket references and leading slashes
  if (path.startsWith('receipts/')) path = path.slice('receipts/'.length)
  path = path.replace(/^\/+/, '')
  // Prevent path traversal
  path = path.replace(/\.\./g, '')
  return path
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const start = url.searchParams.get('start')
    const end = url.searchParams.get('end')

    if (start && !isISODateOnly(start)) {
      return NextResponse.json(
        { code: 'INVALID_DATE', message: 'start must be YYYY-MM-DD' },
        { status: 400 }
      )
    }
    if (end && !isISODateOnly(end)) {
      return NextResponse.json(
        { code: 'INVALID_DATE', message: 'end must be YYYY-MM-DD' },
        { status: 400 }
      )
    }

    const { data: userRes, error: userErr } = await supabaseServer.auth.getUser()
    if (userErr || !userRes?.user) {
      return NextResponse.json(
        { code: 'UNAUTHORIZED', message: 'Authentication required' },
        { status: 401 }
      )
    }

    const user = userRes.user

    // Build transactions query scoped to the user and optional date range
    let txQuery = supabaseServer
      .from('transactions')
      .select('id, occurred_at')
      .eq('user_id', user.id)

    if (start) {
      txQuery = txQuery.gte('occurred_at', startOfDayUTC(start))
    }
    if (end) {
      txQuery = txQuery.lte('occurred_at', endOfDayUTC(end))
    }

    const { data: transactions, error: txErr } = await txQuery
    if (txErr) {
      return NextResponse.json(
        { code: 'DB_ERROR', message: 'Failed to query transactions' },
        { status: 500 }
      )
    }

    const txIds = (transactions ?? []).map((t) => t.id)

    let receipts: { transaction_id: string; url: string | null; content_type: string | null }[] = []
    if (txIds.length > 0) {
      const { data: recs, error: recErr } = await supabaseServer
        .from('transaction_receipts')
        .select('transaction_id, url, content_type')
        .in('transaction_id', txIds)

      if (recErr) {
        return NextResponse.json(
          { code: 'DB_ERROR', message: 'Failed to query receipts' },
          { status: 500 }
        )
      }
      receipts = recs ?? []
    }

    const archive = archiver('zip', { zlib: { level: 9 } })
    const pass = new PassThrough()

    archive.on('warning', (err) => {
      // Non-blocking warnings; still proceed
      console.warn('archiver warning', err)
    })
    archive.on('error', (err) => {
      pass.destroy(err)
    })

    archive.pipe(pass)

    const filenameRangeStart = formatDateForFilename(start)
    const filenameRangeEnd = formatDateForFilename(end)
    const filename = `tris-receipts-${filenameRangeStart}-${filenameRangeEnd}.zip`

    // Begin assembling the archive asynchronously
    ;(async () => {
      const bucket = supabaseServer.storage.from('receipts')
      let includedCount = 0
      let skippedCount = 0
      const warnings: string[] = []

      for (const rec of receipts) {
        try {
          const raw = rec.url || ''
          const key = sanitizePath(raw)
          if (!key) {
            skippedCount++
            warnings.push(`Skipped empty or invalid receipt path for transaction ${rec.transaction_id}`)
            continue
          }
          const { data: fileBlob, error: dlErr } = await bucket.download(key)
          if (dlErr || !fileBlob) {
            skippedCount++
            warnings.push(`Failed to download ${key}`)
            continue
          }
          const buffer = Buffer.from(await fileBlob.arrayBuffer())
          const archivePath = `receipts/${key}`.replace(/\\/g, '/').replace(/^\/+/, '')
          archive.append(buffer, { name: archivePath })
          includedCount++
        } catch (e) {
          skippedCount++
          warnings.push('Error processing a receipt file')
        }
      }

      const manifest = [
        'Tris Receipts Export Manifest',
        `exportedAt: ${new Date().toISOString()}`,
        `userId: ${user.id}`,
        `dateStart: ${start ?? 'all'}`,
        `dateEnd: ${end ?? 'all'}`,
        `transactionsQueried: ${(transactions ?? []).length}`,
        `receiptsFound: ${receipts.length}`,
        `receiptsIncluded: ${includedCount}`,
        `receiptsSkipped: ${skippedCount}`,
        warnings.length ? 'warnings:' : undefined,
        ...warnings.map((w) => `- ${w}`),
      ]
        .filter(Boolean)
        .join('\n')

      archive.append(manifest, { name: 'manifest.txt' })

      await archive.finalize()
    })().catch((err) => {
      pass.destroy(err)
    })

    const headers = new Headers({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
      'X-Content-Type-Options': 'nosniff',
    })

    // Convert Node stream to Web ReadableStream for Next.js response
    const webStream = Readable.toWeb(pass as unknown as NodeJS.ReadableStream) as unknown as ReadableStream
    return new NextResponse(webStream, { headers })
  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Unexpected error while creating receipts archive' },
      { status: 500 }
    )
  }
}
