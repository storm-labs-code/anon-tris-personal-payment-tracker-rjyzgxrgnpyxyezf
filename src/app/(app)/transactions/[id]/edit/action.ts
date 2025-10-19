'use server'

// Intentionally minimal. This page operates fully client-side with local stores and Supabase from the browser.
// A no-op action is exported to satisfy build tooling expectations for an action file presence.
export async function noOp(): Promise<boolean> {
  return true
}
