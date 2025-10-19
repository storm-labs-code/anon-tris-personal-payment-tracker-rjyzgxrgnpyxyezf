/**
 * CODE INSIGHT
 * This code's use case is to render the New Transaction page shell and mount the client-side form for creating a demo transaction.
 * This code's full epic context is the Transactions demo CRUD flow where the client submits to /api/demo/transactions and updates SWR cache then navigates to /transactions.
 * This code's ui feel is clean, mobile-first, calm and confident, using accessible form patterns with inline validation and smooth feedback.
 */

import Client from './client'

export default async function Page() {
  return (
    <section className="mx-auto w-full max-w-2xl p-4 sm:p-6">
      <Client />
    </section>
  )
}
