/**
 * CODE INSIGHT
 * This code's use case is the Recurring Rule detail and edit page for a single user's personal payment tracker.
 * This code's full epic context is to allow users to view and edit a recurring payment rule, preview upcoming occurrences,
 * and manage rule lifecycle actions like save and delete, all scoped to the authenticated user via Supabase RLS.
 * This code's ui feel is clean, calm, and mobile-first with clear grouping, inline validation, and helpful links to related views.
 */

import { supabaseServer } from '@/utils/supabase/client-server'
import Client from './client'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export default async function Page({ params, searchParams }: { params: { ruleId: string }; searchParams?: Record<string, string | string[] | undefined> }) {
  const { ruleId } = params
  const created = searchParams?.created === '1'

  const { data: userRes } = await supabaseServer.auth.getUser()
  const user = userRes?.user

  if (!user) {
    return (
      <div className="p-4 md:p-6">
        <Alert className="bg-muted">
          <AlertTitle>Sign in required</AlertTitle>
          <AlertDescription>Please sign in to view this recurring rule.</AlertDescription>
        </Alert>
      </div>
    )
  }

  const today = new Date()
  const yyyy = today.getFullYear()
  const mm = String(today.getMonth() + 1).padStart(2, '0')
  const dd = String(today.getDate()).padStart(2, '0')
  const todayStr = `${yyyy}-${mm}-${dd}`

  const [{ data: rule, error: ruleError }, { data: categories }, { data: occurrences }] = await Promise.all([
    supabaseServer
      .from('recurring_transactions')
      .select('*')
      .eq('id', ruleId)
      .eq('user_id', user.id)
      .single(),
    supabaseServer
      .from('categories')
      .select('id,name')
      .eq('user_id', user.id)
      .order('name', { ascending: true }),
    supabaseServer
      .from('recurring_occurrences')
      .select('id, occurs_on, status, transaction_id')
      .eq('recurring_transaction_id', ruleId)
      .gte('occurs_on', todayStr)
      .order('occurs_on', { ascending: true })
      .limit(6),
  ])

  if (ruleError || !rule) {
    return (
      <div className="p-4 md:p-6">
        <Alert variant="destructive">
          <AlertTitle>Rule not found</AlertTitle>
          <AlertDescription>This recurring rule could not be loaded or you do not have access.</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-3xl p-4 md:p-6 space-y-4 md:space-y-6">
      {created && (
        <Alert className="border border-primary/20 bg-primary/5 text-primary">
          <AlertTitle>Recurring rule created</AlertTitle>
          <AlertDescription>Your rule was created successfully. You can adjust details below.</AlertDescription>
        </Alert>
      )}
      <Client
        initialRule={rule as any}
        categories={(categories ?? []) as any}
        occurrencesPreview={(occurrences ?? []) as any}
      />
    </div>
  )
}
