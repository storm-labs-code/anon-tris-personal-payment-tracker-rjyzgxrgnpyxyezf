/**
 * CODE INSIGHT
 * This code's use case is to render the Conflict List page showing locally detected sync conflicts
 * between queued client changes and the latest server versions, sourced from IndexedDB. It offers
 * per-item navigation to a detail resolver and bulk resolution actions.
 * This code's full epic context is the Offline-first sync and conflict handling flow where updates
 * that fail optimistic concurrency are captured in a local 'conflicts' store and can be resolved by
 * keeping local changes (mine) or discarding them in favor of the server version.
 * This code's ui feel is clean, calm, mobile-first with modern cards, subtle animations, and clear
 * confirmations for destructive actions.
 */

import React from 'react'
import ConflictListClient from './client'

export const dynamic = 'force-dynamic'

export default async function Page() {
  return (
    <section className="w-full">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-4 md:py-6">
        <div className="mb-4 md:mb-6">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Conflicts</h1>
          <p className="text-sm text-muted-foreground mt-1">Resolve edits that conflicted with newer changes on the server.</p>
        </div>
        <ConflictListClient />
      </div>
    </section>
  )
}
