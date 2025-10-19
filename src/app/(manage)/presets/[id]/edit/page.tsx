/**
 * CODE INSIGHT
 * This code's use case is to render the Edit Preset page for Tris, allowing users to update an existing quick-entry preset.
 * This code's full epic context is the Manage > Presets flow, supporting online (Supabase via API) and offline demo mode with localForage fallback.
 * This code's ui feel is calm, minimal, and mobile-first with clear grouping, inline validation, and smooth interactions.
 */

import Client from './client'

export default async function Page({ params }: { params: { id: string } }) {
  return (
    <div className="py-4">
      <Client presetId={params.id} />
    </div>
  )
}
