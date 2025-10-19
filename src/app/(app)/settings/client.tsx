'use client'

/**
 * CODE INSIGHT
 * This client component renders the Settings UI, manages local state, persists to localStorage, and sets a compact SSR cookie via a server action.
 * It also captures the PWA beforeinstallprompt (if available), offers a fallback install link, and provides demo/data utilities.
 * The UI is mobile-first with card sections, accessible controls, and subtle transitions.
 */

import React, { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { setPrefsCookie } from './action'
import { cn } from '@/utils/utils'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'

export type Prefs = {
  theme: 'light' | 'dark' | 'system'
  highContrast: boolean
  reduceMotion: boolean
  textScale: 'normal' | 'large'
  haptics: boolean
  language: 'en' | 'ko'
  skeletonsDemo: boolean
  animationsDemo: boolean
}

function toCookieValue(p: Prefs): string {
  const obj = {
    t: p.theme === 'light' ? 'l' : p.theme === 'dark' ? 'd' : 's',
    c: p.highContrast ? 1 : 0,
    m: p.reduceMotion ? 1 : 0,
    x: p.textScale === 'large' ? 'l' : 'n',
    h: p.haptics ? 1 : 0,
    g: p.language,
    s: p.skeletonsDemo ? 1 : 0,
    a: p.animationsDemo ? 1 : 0,
  }
  return JSON.stringify(obj)
}

function applyDomAttributes(p: Prefs) {
  const root = document.documentElement
  // Theme handling with system fallback
  let theme: 'light' | 'dark' | 'system' = p.theme
  if (theme === 'system') {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    theme = prefersDark ? 'dark' : 'light'
  }
  root.setAttribute('data-theme', theme)
  root.setAttribute('data-contrast', p.highContrast ? 'high' : 'normal')
  root.setAttribute('data-motion', p.reduceMotion ? 'reduce' : 'normal')
  root.setAttribute('data-text', p.textScale)
}

function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        checked ? 'bg-primary' : 'bg-input',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition',
          checked ? 'translate-x-5' : 'translate-x-1'
        )}
      />
    </button>
  )
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
  label: string
}) {
  return (
    <div className="inline-flex rounded-lg border bg-card p-1 text-sm shadow-sm" role="radiogroup" aria-label={label}>
      {options.map((opt, i) => (
        <button
          key={opt.value}
          role="radio"
          aria-checked={opt.value === value}
          className={cn(
            'min-w-[84px] rounded-md px-3 py-1.5 transition',
            opt.value === value ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:bg-muted',
            i === 0 && 'rounded-l-md',
            i === options.length - 1 && 'rounded-r-md'
          )}
          onClick={() => onChange(opt.value)}
          type="button"
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export default function Client({ initialPrefs }: { initialPrefs: Prefs }) {
  const router = useRouter()
  const [prefs, setPrefs] = useState<Prefs>(initialPrefs)
  const [isPending, startTransition] = useTransition()
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [installPrompt, setInstallPrompt] = useState<any | null>(null)
  const [installed, setInstalled] = useState(false)
  const [online, setOnline] = useState(true)
  const [cleared, setCleared] = useState<string | null>(null)
  const hasHydrated = useRef(false)

  // Hydrate from localStorage on mount for client source of truth
  useEffect(() => {
    try {
      const raw = localStorage.getItem('tris:prefs')
      if (raw) {
        const parsed = JSON.parse(raw)
        const merged: Prefs = { ...initialPrefs, ...parsed }
        setPrefs(merged)
        applyDomAttributes(merged)
      } else {
        applyDomAttributes(initialPrefs)
      }
    } catch {
      applyDomAttributes(initialPrefs)
    }
    hasHydrated.current = true
  }, [initialPrefs])

  // Capture install prompt
  useEffect(() => {
    function onBip(e: any) {
      e.preventDefault()
      setInstallPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', onBip as any)
    // Detect installed
    const mq = window.matchMedia('(display-mode: standalone)')
    const updateInstalled = () => setInstalled(mq.matches || (window.navigator as any).standalone)
    updateInstalled()
    mq.addEventListener('change', updateInstalled)
    // Online status
    const updateOnline = () => setOnline(navigator.onLine)
    updateOnline()
    window.addEventListener('online', updateOnline)
    window.addEventListener('offline', updateOnline)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBip as any)
      mq.removeEventListener('change', updateInstalled)
      window.removeEventListener('online', updateOnline)
      window.removeEventListener('offline', updateOnline)
    }
  }, [])

  function hapticTick() {
    try {
      if (prefs.haptics && 'vibrate' in navigator) navigator.vibrate(10)
    } catch {}
  }

  // Persist to localStorage and cookie whenever prefs change (after hydration)
  useEffect(() => {
    if (!hasHydrated.current) return
    try {
      localStorage.setItem('tris:prefs', JSON.stringify(prefs))
    } catch {}
    applyDomAttributes(prefs)
    const cookieValue = toCookieValue(prefs)
    // Client cookie for immediate SSR hint on next nav
    try {
      document.cookie = `tris_prefs=${encodeURIComponent(cookieValue)}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`
    } catch {}
    // Server action to set cookie on the server side (for SSR navigations)
    startTransition(async () => {
      try {
        await setPrefsCookie(cookieValue)
        setSavedAt(Date.now())
      } catch {
        // noop
      }
    })
  }, [prefs])

  function update<K extends keyof Prefs>(key: K, value: Prefs[K]) {
    setPrefs((p) => ({ ...p, [key]: value }))
    hapticTick()
  }

  async function onInstall() {
    if (!installPrompt) return
    installPrompt.prompt()
    const res = await installPrompt.userChoice
    if (res && res.outcome === 'accepted') setInstallPrompt(null)
  }

  async function clearDemoData() {
    const ok = window.confirm('This will clear local demo transactions and temporary settings. Continue?')
    if (!ok) return
    try {
      localStorage.removeItem('tris:demo:transactions')
      // Optionally clear any demo flags
      setCleared(`Demo data cleared at ${new Date().toLocaleTimeString()}`)
    } catch {
      setCleared('Demo data cleared.')
    }
    hapticTick()
  }

  const savedLabel = useMemo(() => {
    if (isPending) return 'Saving…'
    if (!savedAt) return 'Changes auto-save'
    const seconds = Math.max(1, Math.round((Date.now() - savedAt) / 1000))
    return seconds < 5 ? 'Saved' : 'Saved · just now'
  }, [isPending, savedAt])

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">{savedLabel}</div>
        <div className={cn('inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs', online ? 'bg-green-500/10 text-green-600' : 'bg-destructive/10 text-destructive')}>
          <span className={cn('h-2 w-2 rounded-full', online ? 'bg-green-500' : 'bg-destructive')} />
          {online ? 'Online' : 'Offline'}
        </div>
      </div>

      {/* Appearance */}
      <section className="rounded-xl border bg-card p-4 shadow-sm transition-colors">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-medium">Appearance</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <div className="text-sm font-medium">Theme</div>
            <Segmented
              label="Theme"
              value={prefs.theme}
              onChange={(v) => update('theme', v)}
              options={[
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
                { value: 'system', label: 'System' },
              ]}
            />
            <p className="text-xs text-muted-foreground">Choose your preferred theme. System follows your device.</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Large text</div>
                <p className="text-xs text-muted-foreground">Increases overall text size for readability.</p>
              </div>
              <Switch checked={prefs.textScale === 'large'} onChange={(v) => update('textScale', v ? 'large' : 'normal')} label="Large text" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">High contrast</div>
                <p className="text-xs text-muted-foreground">Boosts contrast for legibility.</p>
              </div>
              <Switch checked={prefs.highContrast} onChange={(v) => update('highContrast', v)} label="High contrast" />
            </div>
          </div>
        </div>
      </section>

      {/* Accessibility */}
      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-medium">Accessibility</h2>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Reduce motion</div>
              <p className="text-xs text-muted-foreground">Minimizes animations and transitions.</p>
            </div>
            <Switch checked={prefs.reduceMotion} onChange={(v) => update('reduceMotion', v)} label="Reduce motion" />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Haptics</div>
              <p className="text-xs text-muted-foreground">Vibration feedback on actions (if supported).</p>
            </div>
            <Switch checked={prefs.haptics} onChange={(v) => update('haptics', v)} label="Haptics" />
          </div>
          <div className="grid gap-2 sm:max-w-sm">
            <label htmlFor="lang" className="text-sm font-medium">
              Language
            </label>
            <select
              id="lang"
              value={prefs.language}
              onChange={(e) => update('language', e.target.value as Prefs['language'])}
              className="rounded-md border bg-background px-3 py-2 text-sm shadow-sm outline-none ring-offset-background transition focus:ring-2 focus:ring-ring"
            >
              <option value="en">English</option>
              <option value="ko">한국어 (Korean)</option>
            </select>
            <p className="text-xs text-muted-foreground">Localization is a stub; more languages coming soon.</p>
          </div>
        </div>
      </section>

      {/* Install */}
      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-medium">Install App</h2>
          {installed && <span className="text-xs text-green-600">Installed</span>}
        </div>
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">Install Tris to your home screen for a fast, native-like experience.</p>
          {installPrompt ? (
            <button
              type="button"
              onClick={onInstall}
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              Install App
            </button>
          ) : (
            <Link
              href="/pwa/install"
              className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium shadow-sm transition hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              How to install
            </Link>
          )}
        </div>
      </section>

      {/* Behavior & Demos */}
      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-medium">Behavior & Demo</h2>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Enable skeletons demo</div>
              <p className="text-xs text-muted-foreground">Show skeleton UIs more often for demo purposes.</p>
            </div>
            <Switch checked={prefs.skeletonsDemo} onChange={(v) => update('skeletonsDemo', v)} label="Skeletons demo" />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Rich animations demo</div>
              <p className="text-xs text-muted-foreground">Prefer animated transitions when possible.</p>
            </div>
            <Switch checked={prefs.animationsDemo} onChange={(v) => update('animationsDemo', v)} label="Animations demo" />
          </div>
        </div>
      </section>

      {/* Data & Debug */}
      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-medium">Data & Debug</h2>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">Manage demo data used in Transactions and Reports.</p>
          <button
            type="button"
            onClick={clearDemoData}
            className="inline-flex items-center justify-center rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground shadow transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-destructive focus:ring-offset-2"
          >
            Clear demo data
          </button>
        </div>
        {cleared && (
          <div className="mt-3">
            <Alert className="border-green-200 bg-green-50 text-green-800 dark:border-green-900/40 dark:bg-green-950/40 dark:text-green-300">
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>{cleared}</AlertDescription>
            </Alert>
          </div>
        )}
        <Separator className="my-4" />
        <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
          <div>
            <div>Theme: <span className="font-medium text-foreground">{prefs.theme}</span></div>
            <div>Contrast: <span className="font-medium text-foreground">{prefs.highContrast ? 'high' : 'normal'}</span></div>
            <div>Motion: <span className="font-medium text-foreground">{prefs.reduceMotion ? 'reduce' : 'normal'}</span></div>
          </div>
          <div>
            <div>Text: <span className="font-medium text-foreground">{prefs.textScale}</span></div>
            <div>Lang: <span className="font-medium text-foreground">{prefs.language}</span></div>
            <div>Install: <span className="font-medium text-foreground">{installed ? 'standalone' : 'browser'}</span></div>
          </div>
        </div>
      </section>

      {/* Helpful links */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link href="/" className="text-primary underline-offset-4 hover:underline">Home</Link>
        <Link href="/transactions" className="text-primary underline-offset-4 hover:underline">Transactions</Link>
        <Link href="/reports" className="text-primary underline-offset-4 hover:underline">Reports</Link>
        <Link href="/pwa/install" className="text-primary underline-offset-4 hover:underline">Install Guide</Link>
      </div>
    </div>
  )
}
