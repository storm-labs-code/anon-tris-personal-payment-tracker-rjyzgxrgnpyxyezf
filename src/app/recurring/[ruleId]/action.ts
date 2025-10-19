'use server'

import { revalidatePath } from 'next/cache'
import { supabaseServer } from '@/utils/supabase/client-server'

export async function updateRecurringRule(ruleId: string, updates: Record<string, any>) {
  const { data: userRes, error: authError } = await supabaseServer.auth.getUser()
  if (authError || !userRes?.user) {
    throw new Error('Not authenticated')
  }
  const userId = userRes.user.id

  // Coerce amount and time formats safely
  const payload: Record<string, any> = { ...updates, updated_at: new Date().toISOString() }
  if (typeof payload.amount !== 'undefined') {
    const n = Number(payload.amount)
    if (!Number.isFinite(n) || n <= 0) throw new Error('Invalid amount')
    payload.amount = Math.floor(n)
  }
  if (typeof payload.reminder_time !== 'undefined' && payload.reminder_time) {
    const t: string = String(payload.reminder_time)
    payload.reminder_time = /^\d{2}:\d{2}:\d{2}$/.test(t) ? t : /^\d{2}:\d{2}$/.test(t) ? `${t}:00` : t
  }

  const { data, error } = await supabaseServer
    .from('recurring_transactions')
    .update(payload)
    .eq('id', ruleId)
    .eq('user_id', userId)
    .select('*')
    .single()

  if (error) {
    throw new Error(error.message || 'Failed to update rule')
  }

  revalidatePath(`/recurring/${ruleId}`)
  revalidatePath(`/recurring/${ruleId}/occurrences`)
  revalidatePath('/upcoming')
  return data
}

export async function deleteRecurringRule(ruleId: string) {
  const { data: userRes, error: authError } = await supabaseServer.auth.getUser()
  if (authError || !userRes?.user) {
    throw new Error('Not authenticated')
  }
  const userId = userRes.user.id

  const { error } = await supabaseServer
    .from('recurring_transactions')
    .delete()
    .eq('id', ruleId)
    .eq('user_id', userId)

  if (error) {
    throw new Error(error.message || 'Failed to delete rule')
  }

  revalidatePath('/recurring')
  revalidatePath('/upcoming')
  return { success: true }
}
