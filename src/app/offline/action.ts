"use server"

export async function noop() {
  return { ok: true, at: new Date().toISOString() }
}
