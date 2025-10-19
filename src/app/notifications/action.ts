"use server"

/**
 * CODE INSIGHT
 * Server actions for Notifications page: update global notifications setting in user_settings and
 * per-rule fields in recurring_transactions. Uses supabaseServer with cookie-based auth context.
 */

import { supabaseServer } from '@/utils/supabase/client-server'

export async function updateGlobalNotificationsEnabled(enabled: boolean) {
  const { data: auth, error: authError } = await supabaseServer.auth.getUser()
  if (authError || !auth?.user) throw new Error('Unauthorized')
  const userId = auth.user.id

  const { data: existing, error: selErr } = await supabaseServer
    .from('user_settings')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()
  if (selErr) throw selErr

  if (existing?.id) {
    const { error } = await supabaseServer
      .from('user_settings')
      .update({ notifications_enabled: enabled, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .eq('user_id', userId)
    if (error) throw error
    return { ok: true }
  } else {
    const { error } = await supabaseServer
      .from('user_settings')
      .insert({ user_id: userId, notifications_enabled: enabled })
    if (error) throw error
    return { ok: true }
  }
}

export async function updateRuleReminderEnabled(ruleId: string, enabled: boolean) {
  const { data: auth, error: authError } = await supabaseServer.auth.getUser()
  if (authError || !auth?.user) throw new Error('Unauthorized')
  const userId = auth.user.id

  const { error } = await supabaseServer
    .from('recurring_transactions')
    .update({ reminder_enabled: enabled, updated_at: new Date().toISOString() })
    .eq('id', ruleId)
    .eq('user_id', userId)
  if (error) throw error
  return { ok: true }
}

export async function updateRuleAutoCreate(ruleId: string, enabled: boolean) {
  const { data: auth, error: authError } = await supabaseServer.auth.getUser()
  if (authError || !auth?.user) throw new Error('Unauthorized')
  const userId = auth.user.id

  const { error } = await supabaseServer
    .from('recurring_transactions')
    .update({ auto_create_transactions: enabled, updated_at: new Date().toISOString() })
    .eq('id', ruleId)
    .eq('user_id', userId)
  if (error) throw error
  return { ok: true }
}
