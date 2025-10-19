'use server'

/**
 * CODE INSIGHT
 * Server actions related to Categories page. Currently provides path revalidation to keep page fresh after mutations.
 */

import { revalidatePath } from 'next/cache'

export async function revalidateCategories() {
  revalidatePath('/(manage)/categories', 'page')
}
