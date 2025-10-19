'use client'

/**
 * CODE INSIGHT
 * This client component renders the interactive Settings list with subtle animations and accessible navigation.
 * It focuses on a calm, clean card-list aesthetic aligned with Tris’s mobile-first UX.
 */

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { cn } from '@/utils/utils'
import * as React from 'react'

type Item = {
  title: string
  description: string
  href: string
  icon?: 'archive'
}

interface Props {
  items: readonly Item[]
}

export default function SettingsClient({ items }: Props) {
  const router = useRouter()

  return (
    <ul className="grid gap-3">
      {items.map((item) => (
        <li key={item.href}>
          <Link
            href={item.href}
            className={cn(
              'group block w-full rounded-xl border bg-card p-4 transition-all',
              'hover:-translate-y-0.5 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              'active:scale-[0.99]'
            )}
            onClick={(e) => {
              // Immediate visual feedback on tap; router push ensures smooth navigation
              e.currentTarget.classList.add('ring-1', 'ring-primary')
              // For SPA speed; Link already handles, but we keep explicit route for programmatic parity
              router.prefetch(item.href)
            }}
            aria-label={`${item.title} – ${item.description}`}
          >
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border bg-background/60',
                  'text-primary transition-colors group-hover:border-primary/40 group-hover:bg-primary/5'
                )}
                aria-hidden
              >
                {item.icon === 'archive' ? <ArchiveIcon className="h-5 w-5" /> : <CircleIcon className="h-5 w-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="truncate text-base font-medium">{item.title}</h2>
                  <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
                <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}

function ArchiveIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <rect x="3.75" y="4.5" width="16.5" height="3.75" rx="1.25" />
      <path d="M6 8.25v9.5A1.75 1.75 0 0 0 7.75 19.5h8.5A1.75 1.75 0 0 0 18 17.75v-9.5" />
      <path d="M9.75 12h4.5" />
    </svg>
  )
}

function ChevronRight(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

function CircleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <circle cx="12" cy="12" r="9" />
    </svg>
  )
}
