/**
 * CODE INSIGHT
 * This code's use case is the Categories Index page showing a sortable list of user categories with favorite toggles and delete/edit actions.
 * This code's full epic context is the Manage > Categories flow of Tris, integrating SWR with API-first fetching and seamless offline/demo-mode fallback via localForage, plus optimistic updates for PATCH/DELETE.
 * This code's ui feel is a calm, minimal, mobile-first list with card-like rows, clear affordances, subtle transitions, and accessible color swatches.
 */

import CategoriesClient from './client'

export default async function Page() {
  return (
    <div className="w-full">
      <CategoriesClient />
    </div>
  )
}
