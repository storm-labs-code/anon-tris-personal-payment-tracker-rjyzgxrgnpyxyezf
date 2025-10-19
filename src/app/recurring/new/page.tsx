/**
 * CODE INSIGHT
 * This code's use case is to render the Create Recurring Rule form page for Tris, enabling users to configure automated payment schedules with reminders and auto-creation.
 * This code's full epic context is the Recurring Payments & Reminders flow, where creating a rule triggers initial occurrence generation via an API and subsequent management across Upcoming and Calendar views.
 * This code's ui feel is clean, calm, and mobile-first with card sections, smooth interactions, KRW-focused inputs, and a sticky action bar for accessible Save/Cancel.
 */

import { supabaseServer } from '@/utils/supabase/client-server'
import Client from './client'

export default async function Page() {
  // Fetch user for scoping queries; if unauthenticated, global guards/layout should handle redirect
  const { data: authData } = await supabaseServer.auth.getUser()
  const user = authData?.user

  let categories: { id: string; name: string }[] = []
  let defaultTimeZone: string | undefined = 'Asia/Seoul'

  if (user?.id) {
    const { data: cats } = await supabaseServer
      .from('categories')
      .select('id, name')
      .eq('user_id', user.id)
      .order('is_favorite', { ascending: false })
      .order('name', { ascending: true })

    categories = cats ?? []

    const { data: settings } = await supabaseServer
      .from('user_settings')
      .select('time_zone')
      .eq('user_id', user.id)
      .limit(1)

    if (settings && settings.length > 0 && settings[0]?.time_zone) {
      defaultTimeZone = settings[0].time_zone as string
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl pb-28">
      <div className="px-4 sm:px-6 lg:px-8 py-4">
        <div className="mb-4">
          <h1 className="text-2xl font-semibold tracking-tight">New Recurring Rule</h1>
          <p className="text-sm text-muted-foreground mt-1">Create an automated schedule for payments with optional reminders and auto-creation.</p>
        </div>
        <Client categories={categories} defaultTimeZone={defaultTimeZone} />
      </div>
    </div>
  )
}
