/**
 * CODE INSIGHT
 * This code's use case is the Tags Index page within the Manage section, providing a searchable, inline-editable list of tags with create/rename/delete actions.
 * This code's full epic context is the Manage > Tags flow in Tris, supporting offline-first behavior with localForage fallback and SWR-based fetching from /api/tags endpoints.
 * This code's ui feel is clean, minimal, and mobile-first with calm interactions, subtle animations, and accessible, modern Tailwind styling.
 */

import Client from './client'

export default async function Page() {
  return (
    <div className="w-full">
      <Client />
    </div>
  )
}
