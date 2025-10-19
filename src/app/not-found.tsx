/**
 * CODE INSIGHT
 * This code's use case is to render a global, accessible 404 (Not Found) page across the app shell.
 * This code's full epic context is the PWA foundation where server-rendered shells delegate to client components for interactions, clear guidance, and fast recovery paths. It links to primary tabs and gently informs users to use the bottom navigation.
 * This code's ui feel is calm, minimal, and mobile-first, with large, touch-friendly actions, subtle motion, and a primary-blue accent for guidance.
 */

import Link from 'next/link'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import Client from './client'

export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12 md:py-20" aria-labelledby="not-found-title">
      <section className="relative overflow-hidden rounded-2xl border border-border bg-card/50 p-6 shadow-sm backdrop-blur-md md:p-8">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-primary/5 to-primary/10" />

        <div className="flex items-center gap-3">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M11.999 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 11.999 2Zm0 14.5a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5ZM12 5.75a.75.75 0 0 0-.75.75v7a.75.75 0 1 0 1.5 0V6.5a.75.75 0 0 0-.75-.75Z" fill="currentColor" />
            </svg>
          </div>
          <h1 id="not-found-title" className="text-balance text-2xl font-semibold tracking-tight md:text-3xl">
            Page not found
          </h1>
        </div>

        <p className="mt-3 text-muted-foreground">
          The page you’re looking for doesn’t exist or has moved. Let’s get you back on track.
        </p>

        <div className="mt-6">
          <Alert className="bg-muted/40">
            <AlertTitle className="flex items-center gap-2">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-sm bg-primary/10 text-primary">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 8v5m0 3h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              404 — Not found
            </AlertTitle>
            <AlertDescription>
              Use the bottom navigation to switch tabs, or pick one of these common destinations.
            </AlertDescription>
          </Alert>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Quick destinations">
          <Link href="/" className="group rounded-xl border border-input bg-background p-4 transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <div className="flex flex-col items-center gap-2">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform group-hover:scale-105">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-5H10v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-10.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="text-sm font-medium">Home</span>
            </div>
          </Link>

          <Link href="/transactions" className="group rounded-xl border border-input bg-background p-4 transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <div className="flex flex-col items-center gap-2">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform group-hover:scale-105">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M8 6h13M3 6h.01M8 12h13M3 12h.01M8 18h13M3 18h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </span>
              <span className="text-sm font-medium">Transactions</span>
            </div>
          </Link>

          <Link href="/reports" className="group rounded-xl border border-input bg-background p-4 transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <div className="flex flex-col items-center gap-2">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform group-hover:scale-105">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M4 20V9m5 11V4m5 16v-8m5 8v-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </span>
              <span className="text-sm font-medium">Reports</span>
            </div>
          </Link>

          <Link href="/settings" className="group rounded-xl border border-input bg-background p-4 transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <div className="flex flex-col items-center gap-2">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform group-hover:scale-105">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" stroke="currentColor" strokeWidth="2" />
                  <path d="M19.4 15a1.8 1.8 0 0 0 .36 1.98l.04.04a2.15 2.15 0 0 1-3.04 3.04l-.04-.04a1.8 1.8 0 0 0-1.98-.36 1.8 1.8 0 0 0-1.08 1.65V22a2.15 2.15 0 0 1-4.3 0v-.07a1.8 1.8 0 0 0-1.08-1.65 1.8 1.8 0 0 0-1.98.36l-.04.04a2.15 2.15 0 0 1-3.04-3.04l.04-.04A1.8 1.8 0 0 0 5 15.4a1.8 1.8 0 0 0-1.65-1.08H3.29a2.15 2.15 0 0 1 0-4.3h.07A1.8 1.8 0 0 0 5 8.69a1.8 1.8 0 0 0-.36-1.98l-.04-.04A2.15 2.15 0 0 1 7.64 3.63l.04.04A1.8 1.8 0 0 0 9.66 4a1.8 1.8 0 0 0 1.08-1.65V2a2.15 2.15 0 0 1 4.3 0v.07A1.8 1.8 0 0 0 16.12 4c.45 0 .89-.16 1.22-.45l.04-.04a2.15 2.15 0 0 1 3.04 3.04l-.04.04A1.8 1.8 0 0 0 19.99 8.7c0 .45.16.89.45 1.22l.04.04a2.15 2.15 0 0 1 0 3.04l-.04.04A1.8 1.8 0 0 0 19.4 15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="text-sm font-medium">Settings</span>
            </div>
          </Link>
        </div>

        <Separator className="my-6" />

        <Client />
      </section>
    </main>
  )
}
