"use server"

/**
 * CODE INSIGHT
 * Server actions for Recurring Rules list: update inline toggle fields with RLS and cache revalidation.
 * This bridges client interactions (auto-create, reminders) with Supabase updates safely on the server.
 */

import { revalidatePath } from 'next/cache'
import { supabaseServer } from '@/utils/supabase/client-server'

export async function updateRecurringRule({
  id,
  patch,
}: {
  id: string
  patch: Partial<{
    auto_create_transactions: boolean
    reminder_enabled: boolean
  }>
}) {
  const { data: auth } = await supabaseServer.auth.getUser()
  const user = auth?.user
  if (!user) {
    throw new Error('Unauthorized')
  }

  const allowed: Record<string, any> = {}
  if (typeof patch.auto_create_transactions === 'boolean') {
    allowed.auto_create_transactions = patch.auto_create_transactions
  }
  if (typeof patch.reminder_enabled === 'boolean') {
    allowed.reminder_enabled = patch.reminder_enabled
  }

  if (Object.keys(allowed).length === 0) {
    return null
  }

  const { data, error } = await supabaseServer
    .from('recurring_transactions')
    .update(allowed)
    .eq('id', id)
    .eq('user_id', user.id)
    .select('*')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/recurring')
  return data
}
