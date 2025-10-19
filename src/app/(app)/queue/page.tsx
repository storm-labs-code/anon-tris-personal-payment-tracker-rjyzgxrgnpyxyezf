/**
 * CODE INSIGHT
 * This code's use case is to render the Sync Queue Center page shell and mount the client-side queue UI.
 * This code's full epic context is the Offline-first Sync feature where the app manages a local sync queue
 * for transactions and receipt uploads, exposing controls to retry, remove, and preview items.
 * This code's ui feel is clean, minimal, and mobile-first, delegating interactive logic to the client file.
 */

import Client from './client'

export default async function Page() {
  return (
    <div className="w-full max-w-4xl mx-auto p-4 md:p-6 lg:p-8">
      <Client />
    </div>
  )
}
