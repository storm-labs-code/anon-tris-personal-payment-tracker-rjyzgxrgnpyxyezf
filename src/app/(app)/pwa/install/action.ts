'use server'

/**
 * CODE INSIGHT
 * Server action for install telemetry/light preference cookie. Records last install attempt to support UX tweaks.
 * No database calls. Safe to call from client on install attempts.
 */

import { cookies } from 'next/headers'

export async function recordInstallAttempt(source?: string) {
  const c = cookies()
  const payload = {
    ts: Date.now(),
    source: source || 'unknown',
  }
  c.set('tris_install_attempt', JSON.stringify(payload), {
    httpOnly: false,
    sameSite: 'Lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 year
  })
  return payload
}
