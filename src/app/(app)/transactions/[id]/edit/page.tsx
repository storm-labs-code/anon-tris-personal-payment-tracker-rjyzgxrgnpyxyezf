/**
 * CODE INSIGHT
 * This code's use case is the Edit Transaction page, which renders the main content area for editing a transaction.
 * This code's full epic context is an offline-first PWA where edits update a local IndexedDB cache and enqueue sync tasks for Supabase when online.
 * This code's ui feel is clean, modern, mobile-first with calming interactions and clear action affordances in a card-based form layout.
 */

import Client from './client'

export default async function Page({ params }: { params: { id: string } }) {
  const { id } = params
  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-6 md:py-8">
      <Client id={id} />
    </div>
  )
}
