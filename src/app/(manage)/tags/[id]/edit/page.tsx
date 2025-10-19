/**
 * CODE INSIGHT
 * This code's use case is to render the Edit Tag page which hosts a client-driven form to rename a tag.
 * This code's full epic context is the Manage > Tags flow within Tris where users can manage tags including renaming with online-first behavior and offline/401 localForage fallback.
 * This code's ui feel is clean, mobile-first, minimal, with calm interactions and clear feedback using Tailwind and small, focused components.
 */

import { EditTagClient } from './client'

export default async function Page({ params }: { params: { id: string } }) {
  return (
    <div className="w-full">
      <EditTagClient tagId={params.id} />
    </div>
  )
}
