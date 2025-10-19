"use server"

/**
 * CODE INSIGHT
 * This action namespace is reserved for server-side utilities related to the Conflicts page.
 * Currently includes a small revalidation helper for future SSR enhancements if needed.
 */

import { revalidatePath } from 'next/cache'

export async function revalidateConflictsPath() {
  revalidatePath('/conflicts')
}
