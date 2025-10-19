/**
 * CODE INSIGHT
 * This code's use case is to provide the PWA Web App Manifest for Tris — a mobile-first personal payment tracker.
 * This code's full epic context is the PWA bootstrap: ensuring installability, proper icons, theme color (#2563EB),
 * and entry points like dashboard, new transaction, and sync queue for an offline-first experience.
 * This code's ui feel is clean, modern, and trustworthy, reflecting calm control with Korean locale polish.
 */

import type { MetadataRoute } from 'next'

export const dynamic = 'force-static'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Tris — Personal Payment Tracker',
    short_name: 'Tris',
    description:
      'A mobile-first PWA to track personal payments in KRW with offline support, quick entry, receipts, and Supabase sync.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#2563EB',
    lang: 'ko-KR',
    dir: 'ltr',
    orientation: 'portrait-primary',
    categories: ['finance', 'productivity', 'utilities'],
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-192-maskable.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Open Dashboard',
        short_name: 'Dashboard',
        description: 'View today’s transactions and summaries',
        url: '/',
        icons: [
          { src: '/icons/shortcut-dashboard.png', sizes: '96x96', type: 'image/png' },
        ],
      },
      {
        name: 'Add Transaction',
        short_name: 'Add',
        description: 'Quickly add a new payment',
        url: '/transactions/new',
        icons: [
          { src: '/icons/shortcut-add.png', sizes: '96x96', type: 'image/png' },
        ],
      },
      {
        name: 'Sync Queue',
        short_name: 'Queue',
        description: 'Review and retry offline changes',
        url: '/queue',
        icons: [
          { src: '/icons/shortcut-queue.png', sizes: '96x96', type: 'image/png' },
        ],
      },
    ],
    prefer_related_applications: false,
  }
}
