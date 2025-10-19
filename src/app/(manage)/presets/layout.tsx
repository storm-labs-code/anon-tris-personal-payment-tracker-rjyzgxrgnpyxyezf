/**
 * CODE INSIGHT
 * This code's use case is to provide a focused nested layout for the Presets management area,
 * rendering a consistent header with title and a primary action to add new presets, while
 * offering lightweight navigation to adjacent Manage sections (Categories, Tags) and the
 * New Transaction flow. It aims to be mobile-first with a clean, calming aesthetic and clear
 * trust signals including sync/auth status. The layout must gracefully wrap various child pages
 * such as list views and edit forms, without overwhelming the user.
 * This code's full epic context is the Manage suite for Categories/Tags/Presets within a
 * PWA connected to Supabase. It respects offline/demo states by surfacing session presence.
 * This code's UI feel is modern, minimal, and responsive, using a sticky header, clear
 * call-to-action, and subtle affordances for navigation.
 */

import React from 'react'
import Link from 'next/link'
import { supabaseServer } from '@/utils/supabase/client-server'

export default async function Layout({ children }: { children: React.ReactNode }) {
  const { data: userData } = await supabaseServer.auth.getUser()
  const isAuthed = Boolean(userData?.user)

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="flex h-14 items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-semibold tracking-tight">Presets</h1>
              <span
                className={
                  isAuthed
                    ? 'inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                    : 'inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
                }
                aria-live="polite"
              >
                {isAuthed ? 'Synced' : 'Demo mode'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/transactions/new"
                className="hidden rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground md:inline-flex"
              >
                New Transaction
              </Link>
              <Link
                href="/presets/new"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 active:scale-[0.98]"
                aria-label="Add Preset"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <path d="M12 5a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H6a1 1 0 110-2h5V6a1 1 0 011-1z" />
                </svg>
                <span className="hidden sm:inline">Add</span>
              </Link>
            </div>
          </div>
          <nav className="-mb-px flex items-center gap-1 overflow-x-auto pb-1 pt-1 text-sm">
            <Link
              href="/categories"
              className="inline-flex items-center rounded-md px-3 py-2 text-muted-foreground transition-colors hover:text-foreground"
            >
              Categories
            </Link>
            <Link
              href="/tags"
              className="inline-flex items-center rounded-md px-3 py-2 text-muted-foreground transition-colors hover:text-foreground"
            >
              Tags
            </Link>
            <span
              aria-current="page"
              className="inline-flex items-center rounded-md bg-accent/60 px-3 py-2 font-medium text-foreground"
            >
              Presets
            </span>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-24 pt-4 sm:px-6">
        {children}
      </main>

      <Link
        href="/presets/new"
        className="fixed bottom-20 right-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 active:scale-95 md:hidden"
        aria-label="Add preset"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="h-6 w-6"
          aria-hidden="true"
        >
          <path d="M12 5a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H6a1 1 0 110-2h5V6a1 1 0 011-1z" />
        </svg>
      </Link>

      <footer className="mx-auto mt-2 hidden w-full max-w-3xl items-center justify-between px-4 pb-6 text-xs text-muted-foreground sm:px-6 md:flex">
        <div className="flex items-center gap-3">
          <span className="font-medium">Tris</span>
          <span>•</span>
          <Link href="/presets" className="hover:text-foreground">Presets</Link>
          <span>•</span>
          <Link href="/categories" className="hover:text-foreground">Categories</Link>
          <span>•</span>
          <Link href="/tags" className="hover:text-foreground">Tags</Link>
        </div>
        <div>
          <span>{isAuthed ? 'Secure session active' : 'No session — using local data'}</span>
        </div>
      </footer>
    </div>
  )
}
