/**
 * CODE INSIGHT
 * This code's use case is the Transactions List page shell that renders server-side and mounts a client component for fetching and displaying demo transactions with infinite pagination.
 * This code's full epic context is the PWA demo with SWR-driven data fetching from /api/demo/transactions, URL cursor management, and mobile-first interactions leading to detail and new transaction flows.
 * This code's ui feel is clean, modern, and calm with responsive spacing, KRW formatting, and subtle motion handled in the client component.
 */

import Client from './client'

export default async function Page({
  searchParams,
}: {
  searchParams: { cursor?: string | null }
}) {
  const initialCursor = (searchParams?.cursor as string) || null

  return (
    <section className="w-full">
      <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <div className="mb-2 sm:mb-4">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Transactions</h1>
          <p className="text-sm text-muted-foreground mt-1">Review, search, and manage your recent payments.</p>
        </div>
        <Client initialCursor={initialCursor} />
      </div>
    </section>
  )
}
