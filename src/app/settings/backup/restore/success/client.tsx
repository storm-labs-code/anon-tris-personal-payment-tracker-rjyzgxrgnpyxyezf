'use client'

import { useEffect, useMemo, useState } from 'react'
import { Separator } from '@/components/ui/separator'

/**
 * CODE INSIGHT
 * This client component animates and presents the restore success summary with friendly visuals and localized number formatting.
 * It complements the server-rendered page by providing subtle motion and responsive stats layout.
 * The UI is minimal, confident, and optimized for mobile-first clarity.
 */

type Mode = 'merge' | 'replace' | (string & {})

type Counts = {
  transactions: number
  receipts: number
  categories: number
  tags: number
  presets: number
  budgets: number
  recurring: number
}

export function RestoreSuccessClient({ mode, counts }: { mode: Mode; counts: Counts }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const nf = useMemo(() => new Intl.NumberFormat('ko-KR'), [])
  const totalItems = counts.transactions + counts.categories + counts.tags + counts.presets + counts.budgets + counts.recurring

  const modeLabel = mode === 'replace' ? 'Replace' : 'Merge'
  const modeColor = mode === 'replace' ? 'bg-destructive text-destructive-foreground' : 'bg-primary/10 text-primary'

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div
          className={[
            'relative inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full',
            'bg-primary text-primary-foreground shadow-sm',
            'transition-all duration-500 ease-out',
            mounted ? 'scale-100 opacity-100' : 'scale-75 opacity-0',
          ].join(' ')}
          aria-hidden
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-primary/30" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Restore complete</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {nf.format(totalItems)} items restored{counts.receipts ? `, ${nf.format(counts.receipts)} receipts linked` : ''}.
          </p>
        </div>
        <span className={`ml-auto inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${modeColor}`}>Mode: {modeLabel}</span>
      </div>

      <Separator />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        <StatCard label="Transactions" value={nf.format(counts.transactions)} accent="bg-primary/10 text-primary" />
        <StatCard label="Receipts" value={nf.format(counts.receipts)} accent="bg-accent text-accent-foreground" />
        <StatCard label="Categories" value={nf.format(counts.categories)} />
        <StatCard label="Tags" value={nf.format(counts.tags)} />
        <StatCard label="Presets" value={nf.format(counts.presets)} />
        <StatCard label="Budgets" value={nf.format(counts.budgets)} />
        <StatCard label="Recurring" value={nf.format(counts.recurring)} />
      </div>
    </div>
  )
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-4 shadow-sm transition-transform hover:scale-[1.01]">
      <div className="flex items-baseline justify-between">
        <span className={['text-xs font-medium uppercase tracking-wide text-muted-foreground', accent ? '' : ''].join(' ')}>{label}</span>
        {accent ? <span className={`hidden rounded-full px-2 py-0.5 text-[10px] font-semibold sm:inline ${accent}`}>OK</span> : null}
      </div>
      <div className="mt-2 text-lg font-semibold">{value}</div>
    </div>
  )
}
