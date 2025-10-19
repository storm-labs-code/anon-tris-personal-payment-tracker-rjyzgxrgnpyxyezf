/**
 * CODE INSIGHT
 * This code's use case is to provide a fast, uncached health check endpoint for the Tris PWA and service worker.
 * This code's full epic context is that the SW uses it to detect online/offline states and retry logic relies on a simple 200 response shape.
 * This code's ui feel is N/A (API endpoint); responses are minimal and consistent: { ok: true, ts }.
 */

import { NextResponse } from 'next/server'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  const payload = { ok: true as const, ts: new Date().toISOString() }

  return new NextResponse(JSON.stringify(payload), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
      'Cross-Origin-Resource-Policy': 'same-origin',
    },
  })
}
