/**
 * CODE INSIGHT
 * This code's use case is the Create Category screen allowing users to add a new spending category with optional icon and color, and mark it as a favorite.
 * This code's full epic context is the Manage > Categories flow with offline-first behavior: attempt POST /api/categories, and on 401/offline, persist locally to localForage('tris.categories') and navigate back.
 * This code's ui feel is calm, clean, and mobile-first with a simple card form, progressive disclosure for appearance options, and clear trust signals including demo/offline status.
 */

import Client from './client'

export default function Page() {
  return (
    <main className="w-full">
      <div className="mx-auto max-w-xl px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-4">
          <h1 className="text-2xl font-semibold tracking-tight">New Category</h1>
          <p className="text-sm text-muted-foreground mt-1">Create a category to organize your transactions. Favorites appear first.</p>
        </div>
        <Client />
      </div>
    </main>
  )
}
