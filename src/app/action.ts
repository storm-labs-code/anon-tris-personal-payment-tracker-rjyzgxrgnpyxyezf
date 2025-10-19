'use server'

import { supabaseServer } from '@/utils/supabase/client-server'

export async function getLandingSummary() {
  try {
    const { data: userData } = await supabaseServer.auth.getUser()
    const user = userData?.user || null

    if (!user) {
      return { ok: true, fullName: null, transactionCount: null }
    }

    const [{ data: profile }, { count }] = await Promise.all([
      supabaseServer.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
      supabaseServer.from('transactions').select('*', { head: true, count: 'exact' }).eq('user_id', user.id),
    ])

    return {
      ok: true,
      fullName: profile?.full_name ?? null,
      transactionCount: typeof count === 'number' ? count : null,
    }
  } catch (error) {
    return { ok: false, error: 'SUMMARY_FETCH_FAILED' }
  }
}
