/**
 * CODE INSIGHT
 * This code's use case is to provide a focused sub-layout for Category management pages, with a clean secondary header,
 * a clear call-to-action to add new categories, and lightweight cross-navigation to related Manage areas (Tags, Presets).
 * This code's full epic context is the Manage flow for Categories within Tris, ensuring a mobile-first, calm, and efficient UI that
 * avoids duplicating global headers while offering quick access to create and navigate. It is designed to wrap all category pages.
 * This code's ui feel is minimal, modern, and responsive with a sticky sub-header, clear hierarchy, and touch-friendly targets.
 */

import Link from "next/link";
import { Separator } from "@/components/ui/separator";

export default async function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh w-full flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 w-full border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-screen-md items-center justify-between px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <h1 className="text-base font-semibold leading-tight tracking-tight sm:text-lg">Categories</h1>
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground sm:text-sm">Organize and favorite the places your money goes</p>
          </div>
          <Link
            href="/(manage)/categories/new"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            aria-label="Add category"
          >
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M10 3a1 1 0 0 1 1 1v5h5a1 1 0 1 1 0 2h-5v5a1 1 0 1 1-2 0v-5H4a1 1 0 1 1 0-2h5V4a1 1 0 0 1 1-1Z" clipRule="evenodd" />
            </svg>
            <span className="hidden sm:inline">Add</span>
          </Link>
        </div>
        <nav className="mx-auto w-full max-w-screen-md px-2 sm:px-6">
          <ul className="flex items-center gap-1 overflow-x-auto pb-2">
            <li>
              <span className="inline-flex select-none items-center rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">Categories</span>
            </li>
            <li>
              <Link
                href="/(manage)/tags"
                className="inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Tags
              </Link>
            </li>
            <li>
              <Link
                href="/(manage)/presets"
                className="inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Presets
              </Link>
            </li>
          </ul>
        </nav>
        <Separator className="mx-auto w-full max-w-screen-md" />
      </header>

      <main className="mx-auto w-full max-w-screen-md flex-1 px-4 pb-24 pt-3 sm:px-6">{children}</main>
    </div>
  );
}
