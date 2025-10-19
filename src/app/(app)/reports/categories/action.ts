/**
 * CODE INSIGHT
 * Server actions for the Reports > Categories page. Provides a minimal helper to read the current
 * user's settings (timezone and currency). While not strictly required by this page, it can be
 * reused by clients to align defaults with user preferences as the Settings epic lands.
 */

'use server'

import { supabaseServer } from '@/utils/supabase/client-server'

export async function getUserSettings() {
  const {
    data: { user },
  } = await supabaseServer.auth.getUser()

  if (!user) {
    return { time_zone: 'Asia/Seoul', primary_currency: 'KRW' }
  }

  const { data, error } = await supabaseServer
    .from('user_settings')
    .select('time_zone, primary_currency')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error || !data) {
    return { time_zone: 'Asia/Seoul', primary_currency: 'KRW' }
  }

  return {
    time_zone: data.time_zone || 'Asia/Seoul',
    primary_currency: data.primary_currency || 'KRW',
  }
}
