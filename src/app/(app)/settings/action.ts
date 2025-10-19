'use server'

/**
 * CODE INSIGHT
 * Server actions for the Settings page. Sets a compact JSON cookie 'tris_prefs' for SSR theming and accessibility flags.
 */

import { cookies } from 'next/headers'

export async function setPrefsCookie(value: string) {
  try {
    // Validate JSON to avoid corrupting cookie
    JSON.parse(value)
  } catch {
    return { ok: false }
  }
  const isSecure = process.env.NODE_ENV === 'production'
  cookies().set('tris_prefs', value, {
    path: '/',
    httpOnly: false, // client must read for hydration; SSR still benefits
    sameSite: 'lax',
    secure: isSecure,
    maxAge: 60 * 60 * 24 * 365, // 1 year
  })
  return { ok: true }
}
