/**
 * CODE INSIGHT
 * This code's use case is the Transaction Detail page that reads the :id param, validates existence server-side,
 * and renders a client-driven detail view fetching from the demo API. It presents read-only fields with actions
 * to edit (placeholder) and delete (functional via API), matching the mobile-first PWA design.
 * This code's full epic context is the demo CRUD flow where data is fetched via /api/demo/transactions and
 * client-side SWR manages cache and optimistic UX. Server performs a notFound() on 404 to align with routing.
 * This code's ui feel is clean, calm, and confident with card-based layout, subtle motion, and accessible patterns.
 */

import Link from 'next/link'
import { notFound } from 'next/navigation'
import Client from './client'

export default async function Page({ params }: { params: { id: string } }) {
  const id = params.id

  // Validate existence server-side to enable segment-level notFound
  try {
    const res = await fetch(`/api/demo/transactions/${encodeURIComponent(id)}`, { cache: 'no-store' })
    if (res.status === 404) {
      notFound()
    }
    // Ignore body; client will refetch and render the actual content
  } catch {
    // If the API is temporarily unreachable, we still render the client which has its own error UI
  }

  return (
    <section className="mx-auto w-full max-w-2xl p-4 sm:p-6">
      <div className="mb-4 flex items-center gap-3 text-sm text-muted-foreground">
        <Link href="/transactions" className="inline-flex items-center rounded-md px-2 py-1 transition-colors hover:bg-muted" aria-label="Back to transactions">
          ← Back
        </Link>
        <span aria-hidden>•</span>
        <span className="truncate" title={id}>Txn: {id}</span>
      </div>

      <Client id={id} />

      <div className="mt-8 flex justify-center">
        <Link href="/reports" className="text-sm text-primary hover:underline">View spending reports →</Link>
      </div>
    </section>
  )
}
