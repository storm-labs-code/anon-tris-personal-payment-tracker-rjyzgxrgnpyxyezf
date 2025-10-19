'use server'

import { revalidatePath } from 'next/cache'

export async function revalidateOccurrences(path: string) {
  // Helper to revalidate this page path when server actions are used in the future
  try {
    revalidatePath(path)
  } catch {}
}
