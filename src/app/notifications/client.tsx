'use client'

/**
 * CODE INSIGHT
 * Client-side interactive controls for Notifications page: global reminders toggle, per-rule toggles,
 * push subscription enable/disable, test notification, and device-level default reminder time/offset.
 * Integrates with server actions for DB writes and fetches push API endpoints for browser subscription.
 */

import { useEffect, useMemo, useState, useCallback } from 'react'
import Link from 'next/link'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { cn } from '@/utils/utils'
import { updateGlobalNotificationsEnabled, updateRuleAutoCreate, updateRuleReminderEnabled } from './action'

type RuleItem = {
  id: string
  payee: string | null
  amount: number | string
  reminder_enabled: boolean
  auto_create_transactions: boolean
}

type Props = {
  initialSettings: { remindersEnabled: boolean }
  rules: RuleItem[]
  lastSubscriptionUpdatedAt: string | null
}

export default function NotificationsClient({ initialSettings, rules, lastSubscriptionUpdatedAt }: Props) {
  const [globalEnabled, setGlobalEnabled] = useState(initialSettings.remindersEnabled)
  const [savingGlobal, setSavingGlobal] = useState(false)
  const [globalSavedAt, setGlobalSavedAt] = useState<string | null>(null)

  const [list, setList] = useState<RuleItem[]>(rules)
  const [savingRuleId, setSavingRuleId] = useState<string | null>(null)

  const [permission, setPermission] = useState<NotificationPermission>(typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default')
  const [pushSupported, setPushSupported] = useState(false)
  const [subActive, setSubActive] = useState<boolean>(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [pushError, setPushError] = useState<string | null>(null)
  const [testBusy, setTestBusy] = useState(false)

  const [defaultTime, setDefaultTime] = useState<string>('09:00')
  const [defaultOffset, setDefaultOffset] = useState<number>(60)
  const [defaultsSavedAt, setDefaultsSavedAt] = useState<string | null>(null)

  useEffect(() => {
    setPushSupported(typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window)
    setPermission(typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default')
  }, [])

  // Load and watch existing push subscription
  useEffect(() => {
    let mounted = true
    ;(async () => {
      if (!('serviceWorker' in navigator)) return
      try {
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.getSubscription()
        if (!mounted) return
        setSubActive(!!sub)
      } catch (e) {
        // ignore
      }
    })()
    return () => { mounted = false }
  }, [])

  // Device-level defaults (local persistence only)
  useEffect(() => {
    try {
      const t = localStorage.getItem('tris:notify:default_time')
      const o = localStorage.getItem('tris:notify:default_offset')
      if (t) setDefaultTime(t)
      if (o) setDefaultOffset(Number(o))
    } catch {}
  }, [])

  const saveDeviceDefaults = useCallback(() => {
    try {
      localStorage.setItem('tris:notify:default_time', defaultTime)
      localStorage.setItem('tris:notify:default_offset', String(defaultOffset))
      setDefaultsSavedAt(new Date().toISOString())
    } catch {}
  }, [defaultTime, defaultOffset])

  const formatTime = (iso: string | null) => {
    if (!iso) return '—'
    try {
      const d = new Date(iso)
      return d.toLocaleString()
    } catch {
      return iso ?? '—'
    }
  }

  const formatKRW = useCallback((val: number | string) => {
    const n = typeof val === 'string' ? Number(val) : val
    if (!Number.isFinite(n)) return '₩—'
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(n)
  }, [])

  const handleToggleGlobal = async () => {
    const next = !globalEnabled
    setSavingGlobal(true)
    setGlobalEnabled(next)
    try {
      await updateGlobalNotificationsEnabled(next)
      setGlobalSavedAt(new Date().toISOString())
    } catch (e) {
      // revert on error
      setGlobalEnabled(!next)
    } finally {
      setSavingGlobal(false)
    }
  }

  const handleToggleRuleReminder = async (ruleId: string, current: boolean) => {
    const next = !current
    setSavingRuleId(ruleId)
    setList((prev) => prev.map((r) => (r.id === ruleId ? { ...r, reminder_enabled: next } : r)))
    try {
      await updateRuleReminderEnabled(ruleId, next)
    } catch (e) {
      setList((prev) => prev.map((r) => (r.id === ruleId ? { ...r, reminder_enabled: current } : r)))
    } finally {
      setSavingRuleId(null)
    }
  }

  const handleToggleRuleAutoCreate = async (ruleId: string, current: boolean) => {
    const next = !current
    setSavingRuleId(ruleId)
    setList((prev) => prev.map((r) => (r.id === ruleId ? { ...r, auto_create_transactions: next } : r)))
    try {
      await updateRuleAutoCreate(ruleId, next)
    } catch (e) {
      setList((prev) => prev.map((r) => (r.id === ruleId ? { ...r, auto_create_transactions: current } : r)))
    } finally {
      setSavingRuleId(null)
    }
  }

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const rawData = typeof window !== 'undefined' ? window.atob(base64) : Buffer.from(base64, 'base64').toString('binary')
    const outputArray = new Uint8Array(rawData.length)
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
  }

  const enablePush = async () => {
    setPushBusy(true)
    setPushError(null)
    try {
      if (!pushSupported) throw new Error('Push not supported')
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== 'granted') throw new Error('Permission was not granted')

      const res = await fetch('/api/notifications/vapid-public-key')
      if (!res.ok) throw new Error('Failed to get VAPID key')
      const data = await res.json()
      const publicKey: string = data.publicKey || data.vapidPublicKey || data.key
      if (!publicKey) throw new Error('Invalid VAPID key response')

      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) })

      const payload: any = {
        endpoint: sub.endpoint,
        keys: (sub as any).toJSON?.().keys || { p256dh: (sub as any).keys?.p256dh, auth: (sub as any).keys?.auth },
        expirationTime: (sub as any).expirationTime ?? null,
        userAgent: navigator.userAgent,
      }

      const resp = await fetch('/api/notifications/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!resp.ok) throw new Error('Failed to register subscription')

      setSubActive(true)
    } catch (e: any) {
      setPushError(e?.message || 'Failed to enable push')
    } finally {
      setPushBusy(false)
    }
  }

  const disablePush = async () => {
    setPushBusy(true)
    setPushError(null)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        const endpoint = sub.endpoint
        try {
          await sub.unsubscribe()
        } catch {}
        await fetch('/api/notifications/subscribe', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint }) })
      }
      setSubActive(false)
    } catch (e: any) {
      setPushError(e?.message || 'Failed to disable push')
    } finally {
      setPushBusy(false)
    }
  }

  const sendTest = async () => {
    setTestBusy(true)
    try {
      await fetch('/api/notifications/test', { method: 'POST' })
    } finally {
      setTestBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <Alert className="bg-muted border-muted-foreground/20">
        <AlertTitle className="font-semibold">Stay on top of bills</AlertTitle>
        <AlertDescription className="text-sm mt-1">Enable reminders and push notifications to get timely alerts for upcoming payments. You can manage global and per-rule settings below.</AlertDescription>
      </Alert>

      <section className="rounded-xl border bg-card text-card-foreground overflow-hidden">
        <div className="p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">Global Reminders</h2>
              <p className="text-sm text-muted-foreground mt-1">Master switch for reminders across all recurring items.</p>
            </div>
            <button
              type="button"
              aria-label="Toggle global reminders"
              role="switch"
              aria-checked={globalEnabled}
              onClick={handleToggleGlobal}
              disabled={savingGlobal}
              className={cn(
                'relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring',
                globalEnabled ? 'bg-primary' : 'bg-muted'
              )}
            >
              <span
                className={cn(
                  'inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform',
                  globalEnabled ? 'translate-x-6' : 'translate-x-1'
                )}
              />
            </button>
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            {savingGlobal ? 'Saving…' : globalSavedAt ? `Saved • ${formatTime(globalSavedAt)}` : '—'}
          </div>
        </div>
        <Separator />
        <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Default reminder time</label>
            <input
              type="time"
              value={defaultTime}
              onChange={(e) => setDefaultTime(e.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="text-xs text-muted-foreground">Used as the default reminder time on this device.</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Default offset (minutes)</label>
            <input
              type="number"
              min={0}
              step={5}
              value={defaultOffset}
              onChange={(e) => setDefaultOffset(Number(e.target.value))}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="text-xs text-muted-foreground">How long before due time to remind you by default.</p>
          </div>
          <div className="sm:col-span-2 flex items-center justify-between">
            <div className="text-xs text-muted-foreground">{defaultsSavedAt ? `Defaults saved • ${formatTime(defaultsSavedAt)}` : '—'}</div>
            <button
              onClick={saveDeviceDefaults}
              className="inline-flex items-center rounded-lg bg-secondary px-4 py-2 text-sm text-secondary-foreground hover:opacity-90"
            >
              Save Defaults
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border bg-card text-card-foreground p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Push Notifications</h2>
            <p className="text-sm text-muted-foreground mt-1">Enable browser push to receive alerts even when the app is closed.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs rounded-full px-2 py-1 border bg-background">{permission}</span>
          </div>
        </div>
        <div className="mt-4 flex flex-col sm:flex-row gap-3">
          <button
            onClick={subActive ? disablePush : enablePush}
            disabled={!pushSupported || pushBusy}
            className={cn(
              'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm',
              subActive ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground',
              pushBusy && 'opacity-80'
            )}
          >
            {pushBusy ? 'Please wait…' : subActive ? 'Disable Push' : 'Enable Push'}
          </button>
          <button
            onClick={sendTest}
            disabled={!subActive || testBusy}
            className={cn('inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm hover:bg-accent hover:text-accent-foreground', (!subActive || testBusy) && 'opacity-70')}
          >
            {testBusy ? 'Sending…' : 'Send Test'}
          </button>
        </div>
        <div className="mt-3 text-xs text-muted-foreground">
          <div>Support: {pushSupported ? 'Available' : 'Not available on this browser'}</div>
          <div>Last subscription update: {formatTime(lastSubscriptionUpdatedAt)}</div>
          {pushError && <div className="text-destructive mt-1">{pushError}</div>}
        </div>
      </section>

      <section className="rounded-xl border bg-card text-card-foreground p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Per-Rule Controls</h2>
            <p className="text-sm text-muted-foreground mt-1">Manage reminders and auto-create for each recurring rule.</p>
          </div>
          <Link href="/recurring" className="text-primary text-sm hover:underline">Edit rules</Link>
        </div>
        <div className="mt-4 divide-y border rounded-lg overflow-hidden">
          {list.length === 0 && (
            <div className="p-4 text-sm text-muted-foreground">No recurring rules yet. Create one in Recurring.</div>
          )}
          {list.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 p-4 bg-background/60">
              <div className="min-w-0">
                <div className="font-medium truncate">{r.payee || 'Recurring payment'}</div>
                <div className="text-xs text-muted-foreground">{formatKRW(r.amount)}</div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Reminders</div>
                  <button
                    type="button"
                    aria-label="Toggle reminders"
                    role="switch"
                    aria-checked={r.reminder_enabled}
                    onClick={() => handleToggleRuleReminder(r.id, r.reminder_enabled)}
                    disabled={savingRuleId === r.id}
                    className={cn('relative inline-flex h-6 w-10 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring', r.reminder_enabled ? 'bg-primary' : 'bg-muted')}
                  >
                    <span className={cn('inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform', r.reminder_enabled ? 'translate-x-5' : 'translate-x-1')} />
                  </button>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Auto-create</div>
                  <button
                    type="button"
                    aria-label="Toggle auto create"
                    role="switch"
                    aria-checked={r.auto_create_transactions}
                    onClick={() => handleToggleRuleAutoCreate(r.id, r.auto_create_transactions)}
                    disabled={savingRuleId === r.id}
                    className={cn('relative inline-flex h-6 w-10 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring', r.auto_create_transactions ? 'bg-primary' : 'bg-muted')}
                  >
                    <span className={cn('inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform', r.auto_create_transactions ? 'translate-x-5' : 'translate-x-1')} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
