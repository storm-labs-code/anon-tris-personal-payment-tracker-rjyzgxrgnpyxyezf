/**
 * CODE INSIGHT
 * This code's use case is the Presets Index page that lists quick-entry presets, supports offline demo mode,
 * and enables applying, editing, and deleting presets with optimistic updates.
 * This code's full epic context is the Manage > Presets flow, where users manage presets used to prefill new transactions
 * and can navigate to create/edit presets or apply one into the new transaction form.
 * This code's ui feel is modern, minimal, mobile-first with card-based list items, smooth interactions,
 * and clear primary actions aligned to Tris’s calm and confident tone.
 */

import Client from './client'

export default async function Page() {
  return (
    <div className="mx-auto w-full max-w-3xl p-4 sm:p-6">
      <Client />
    </div>
  )
}
