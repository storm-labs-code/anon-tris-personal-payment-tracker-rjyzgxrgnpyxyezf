/**
 * CODE INSIGHT
 * This server action file is intentionally minimal for the Sync Queue page, which operates entirely on
 * client-side IndexedDB. No server action is required for the queue listing/controls.
 * Keeping this file scoped for future enhancements (e.g., server timestamp or secure triggers) if needed.
 */

'use server'

export async function serverTime(): Promise<string> {
  return new Date().toISOString()
}
