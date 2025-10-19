/**
 * CODE INSIGHT
 * This code's use case is the Edit Category page for Tris. It renders a client-driven form to edit a category's name, icon, color, and favorite state.
 * This code's full epic context is the Manage > Categories flow with offline-first behavior: fetch from /api/categories/[id], and if unauthorized/offline, fall back to localForage('tris.categories').
 * This code's ui feel is calm, minimal, and mobile-first with card-based form, clear validation, and subtle interactions.
 */

import Client from './client.tsx'

export default async function Page({ params }: { params: { id: string } }) {
  return (
    <Client id={params.id} />
  )
}
