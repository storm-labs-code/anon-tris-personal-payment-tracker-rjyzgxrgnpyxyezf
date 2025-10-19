/**
 * CODE INSIGHT
 * This code's use case is the Reports page shell that renders a client analytics dashboard for spending summaries.
 * This code's full epic context is to fetch demo summary data via /api/demo/summary with a user-selected range (7/30/90),
 * render trend and category charts with dynamic imports to minimize JS, and provide accessible summaries and responsive UI.
 * This code's ui feel is calm, modern, and mobile-first with clear cards, subtle motion, and primary blue accents.
 */

import Client from './client.tsx'

export default function ReportsPage() {
  return (
    <section className="w-full space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="text-muted-foreground">Visualize your spending and compare categories over time.</p>
      </header>

      <Client />
    </section>
  )
}
