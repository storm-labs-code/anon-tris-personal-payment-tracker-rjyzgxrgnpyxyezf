/**
 * CODE INSIGHT
 * This code's use case is to render the Conflict Resolution page for a single transaction update conflict.
 * This code's full epic context is the offline-first sync system where local updates can conflict with server state.
 * The UI feel is calm, concise, and mobile-first, offering clear side-by-side comparisons and decisive actions with minimal friction.
 */

import Client from './client'

export default async function Page({ params }: { params: { id: string } }) {
  const { id } = params
  return (
    <div className="mx-auto w-full max-w-4xl px-3 py-4 sm:px-4 md:px-6">
      <Client conflictId={id} />
    </div>
  )
}
