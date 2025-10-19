/**
 * CODE INSIGHT
 * This code's use case is the New Transaction entry page where users can quickly add a payment, optionally prefilled from a preset.
 * This code's full epic context is the Presets and Offline-First demo: it fetches presets/categories/tags via API with offline fallbacks to localForage and seeds demo data when unauthenticated/offline. It also stubs server save with a 501 notice.
 * This code's ui feel is calm, modern, and mobile-first: clear field groupings, KRW formatting, favorites-first categories, chip-based tags with smart suggestions, and a sticky action bar for primary actions.
 */

import { NewTransactionClient } from './client'

export default async function Page() {
  return (
    <div className="w-full">
      <NewTransactionClient />
    </div>
  )
}
