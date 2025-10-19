'use server'

import { supabaseServer } from '@/utils/supabase/client-server'

export async function getSessionStatus(): Promise<{ authenticated: boolean; email?: string | null }> {
  const { data, error } = await supabaseServer.auth.getUser()
  if (error) return { authenticated: false, email: null }
  return { authenticated: !!data.user, email: data.user?.email ?? null }
}
