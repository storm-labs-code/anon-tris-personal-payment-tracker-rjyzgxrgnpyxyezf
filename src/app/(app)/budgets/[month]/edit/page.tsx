/**
 * CODE INSIGHT
 * This code's use case is to render the Budget Editor page for a specific month, delegating interactive form logic to a client component.
 * This code's full epic context is the Budgets Editor under the Budgets feature, enabling users to set/update monthly category and overall budgets, thresholds, and reset a month.
 * This code's ui feel is modern, minimal, mobile-first with clear, calm interactions focused on inline validation and swift actions.
 */

import ClientEditor from './client'

interface PageProps {
  params: { month: string }
}

export default async function Page({ params }: PageProps) {
  const { month } = params
  return (
    <div className="w-full">
      <ClientEditor month={month} />
    </div>
  )
}
