/**
 * CODE INSIGHT
 * This code's use case is to expose the public VAPID key for Web Push subscriptions via a simple GET API endpoint.
 * This code's full epic context is the Notifications settings flow where the client retrieves the VAPID key to register a PushSubscription and enable push reminders.
 * This code's ui feel is N/A (API only), but the behavior emphasizes reliability, proper caching, and clear error messages.
 */

import { NextResponse } from 'next/server'

function resolvePublicVapidKey(): string | null {
  const raw =
    process.env.PUSH_VAPID_PUBLIC_KEY ||
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
    process.env.VAPID_PUBLIC_KEY ||
    process.env.WEB_PUSH_PUBLIC_KEY ||
    null

  if (!raw) return null
  const sanitized = raw.trim().replace(/^"(.+)"$/, '$1').replace(/^'(.*)'$/, '$1')
  return sanitized.length > 0 ? sanitized : null
}

export async function GET() {
  try {
    const publicKey = resolvePublicVapidKey()

    if (!publicKey) {
      return NextResponse.json(
        { error: 'VAPID public key not configured' },
        { status: 503 }
      )
    }

    return NextResponse.json(
      { publicKey },
      {
        headers: {
          'Cache-Control': 'public, max-age=86400, s-maxage=86400, immutable',
        },
      }
    )
  } catch (error) {
    console.error('Error retrieving VAPID public key', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
