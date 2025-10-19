/**
 * CODE INSIGHT
 * This code's use case is to render the Create Preset page for Tris, focusing only on the main content area.
 * This code's full epic context is the Manage > Presets flow where users can add quick-entry presets, with offline-first fallback via localForage and API-based sync to Supabase.
 * This code's ui feel is calm, clean, mobile-first with a modern card form, smooth interactions, and clear trust signals for demo/offline modes.
 */

import Client from './client';

export default async function Page() {
  return (
    <div className="w-full">
      <Client />
    </div>
  );
}
