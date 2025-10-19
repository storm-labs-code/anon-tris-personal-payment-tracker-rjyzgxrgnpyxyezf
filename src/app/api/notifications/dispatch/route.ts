/**
 * CODE INSIGHT
 * This code's use case is to dispatch web push reminders for due recurring occurrences within a time window.
 * This code's full epic context is the Notifications & Reminders flow: a scheduled task calls this endpoint with a secret; it selects occurrences due soon for users with notifications enabled and active push subscriptions, sends web push payloads, and records reminder_sent_at to prevent duplicates. It also deactivates dead subscriptions.
 * This code's ui feel is not applicable (API route), but it supports a calm, reliable UX by ensuring timely, accurate reminders.
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/utils/supabase/client-admin'
import webPush from 'web-push'
import { DateTime } from 'luxon'

export const runtime = 'nodejs'

// Helpers
function getEnv(name: string): string | undefined {
  const v = process.env[name]
  return v && v.length > 0 ? v : undefined
}

function parseJSON<T>(str: string | null): Partial<T> {
  if (!str) return {}
  try {
    return JSON.parse(str)
  } catch {
    return {}
  }
}

function normalizeWindowMinutes(input?: unknown, fallback = 15): number {
  const n = typeof input === 'number' && Number.isFinite(input) ? input : fallback
  return Math.min(Math.max(Math.floor(n), 1), 180)
}

function timeStringFromDB(t?: string | null): string {
  // DB time may be HH:MM or HH:MM:SS
  if (!t) return '09:00:00'
  const parts = t.split(':')
  if (parts.length === 2) return `${parts[0]}:${parts[1]}:00`
  if (parts.length >= 3) return `${parts[0]}:${parts[1]}:${parts[2]}`
  return '09:00:00'
}

function toUTCFromZone(dateISO: string, timeISO: string, zone: string): DateTime {
  const local = DateTime.fromISO(`${dateISO}T${timeISO}`, { zone: zone || 'UTC' })
  return local.toUTC()
}

function buildNotificationPayload(params: {
  occurrenceId: string
  ruleId: string
  dueDate: string
  userTZ: string
  payee?: string | null
}): string {
  const { occurrenceId, ruleId, dueDate, userTZ, payee } = params
  const localDate = DateTime.fromISO(dueDate, { zone: userTZ || 'UTC' })
  const dateText = localDate.toFormat('yyyy-LL-dd')
  const title = '결제 알림'
  const body = payee ? `${payee} — ${dateText}` : `예정일: ${dateText}`
  const url = `/upcoming?focus=${encodeURIComponent(occurrenceId)}`
  return JSON.stringify({
    type: 'occurrence_reminder',
    title,
    body,
    url,
    lang: 'ko-KR',
    data: {
      occurrenceId,
      ruleId,
      openURL: url,
    },
  })
}

export async function POST(req: Request) {
  try {
    const cronSecret = getEnv('CRON_SECRET')
    const provided = req.headers.get('x-cron-secret') || req.headers.get('X-CRON-SECRET')
    if (!cronSecret || !provided || provided !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { windowMinutes: bodyWindow } = parseJSON<{ windowMinutes?: number }>(await req.text())
    const windowMinutes = normalizeWindowMinutes(bodyWindow, 15)

    const vapidPublicKey = getEnv('VAPID_PUBLIC_KEY')
    const vapidPrivateKey = getEnv('VAPID_PRIVATE_KEY')
    const vapidSubject = getEnv('VAPID_SUBJECT') || 'mailto:admin@example.com'

    if (!vapidPublicKey || !vapidPrivateKey) {
      return NextResponse.json({ error: 'Server not configured for push (missing VAPID keys)' }, { status: 500 })
    }

    webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

    const nowUtc = DateTime.utc()
    const windowEnd = nowUtc.plus({ minutes: windowMinutes })
    const dateUpperBound = windowEnd.plus({ days: 1 }).toISODate()!

    // 1) Pull candidate occurrences (unnotified, upcoming or snoozed) within the window horizon by date
    const { data: occs, error: occErr } = await supabaseAdmin
      .from('recurring_occurrences')
      .select('id,user_id,recurring_transaction_id,occurs_on,status,transaction_id,snoozed_until,reminder_sent_at')
      .is('reminder_sent_at', null)
      .in('status', ['upcoming', 'snoozed'])
      .or(`snoozed_until.lte.${dateUpperBound},occurs_on.lte.${dateUpperBound}`)

    if (occErr) {
      return NextResponse.json({ error: 'Failed to query occurrences', details: occErr.message }, { status: 500 })
    }

    const occurrences = (occs || [])
    const occurrencesConsidered = occurrences.length

    if (occurrences.length === 0) {
      return NextResponse.json({
        windowMinutes,
        occurrencesConsidered: 0,
        occurrencesNotified: 0,
        notificationsSent: 0,
        notificationsFailed: 0,
        deactivatedSubscriptions: 0,
      })
    }

    const userIds = Array.from(new Set(occurrences.map(o => o.user_id)))
    const ruleIds = Array.from(new Set(occurrences.map(o => o.recurring_transaction_id)))

    // 2) Load active push subscriptions for those users
    const { data: subs, error: subsErr } = await supabaseAdmin
      .from('push_subscriptions')
      .select('id,user_id,endpoint,p256dh,auth,is_active,expiration_time')
      .in('user_id', userIds)
      .eq('is_active', true)

    if (subsErr) {
      return NextResponse.json({ error: 'Failed to query subscriptions', details: subsErr.message }, { status: 500 })
    }

    const subsByUser = new Map<string, typeof subs>()
    for (const s of subs || []) {
      if (!subsByUser.has(s.user_id)) subsByUser.set(s.user_id, [])
      subsByUser.get(s.user_id)!.push(s)
    }

    // 3) Load user settings (notifications_enabled, time_zone)
    const { data: settings, error: settingsErr } = await supabaseAdmin
      .from('user_settings')
      .select('user_id,notifications_enabled,time_zone')
      .in('user_id', userIds)

    if (settingsErr) {
      return NextResponse.json({ error: 'Failed to query user settings', details: settingsErr.message }, { status: 500 })
    }

    const settingsByUser = new Map<string, { notifications_enabled: boolean; time_zone: string | null }>()
    for (const s of settings || []) {
      settingsByUser.set(s.user_id, {
        notifications_enabled: s.notifications_enabled ?? true,
        time_zone: s.time_zone ?? 'UTC',
      })
    }

    // 4) Load recurring transaction rules for reminder flags/time and optional payee
    const { data: rules, error: rulesErr } = await supabaseAdmin
      .from('recurring_transactions')
      .select('id,user_id,reminder_enabled,reminder_time,payee')
      .in('id', ruleIds)

    if (rulesErr) {
      return NextResponse.json({ error: 'Failed to query recurring rules', details: rulesErr.message }, { status: 500 })
    }

    const rulesById = new Map<string, { reminder_enabled: boolean; reminder_time: string | null; payee: string | null }>()
    for (const r of rules || []) {
      rulesById.set(r.id, {
        reminder_enabled: !!r.reminder_enabled,
        reminder_time: r.reminder_time ?? null,
        payee: r.payee ?? null,
      })
    }

    // 5) Filter occurrences to those due within window for users with active subs and enabled notifications
    type DispatchItem = {
      occurrenceId: string
      userId: string
      ruleId: string
      remindAtUtc: DateTime
      userTZ: string
      payee?: string | null
      effectiveDateISO: string
    }

    const toDispatch: DispatchItem[] = []

    for (const occ of occurrences) {
      const userId = occ.user_id as string
      const ruleId = occ.recurring_transaction_id as string

      const userSubs = subsByUser.get(userId)
      if (!userSubs || userSubs.length === 0) continue

      const userSetting = settingsByUser.get(userId) || { notifications_enabled: true, time_zone: 'UTC' }
      const rule = rulesById.get(ruleId) || { reminder_enabled: false, reminder_time: null, payee: null }

      const remindersEnabled = (userSetting.notifications_enabled ?? true) || rule.reminder_enabled
      if (!remindersEnabled) continue

      const tz = (userSetting.time_zone as string) || 'UTC'
      const effectiveDate = (occ.snoozed_until as string) || (occ.occurs_on as string)
      if (!effectiveDate) continue

      const timeStr = timeStringFromDB(rule.reminder_time)
      const remindAtUtc = toUTCFromZone(effectiveDate, timeStr, tz)

      // Check if the reminder time falls within the dispatch window
      if (remindAtUtc <= windowEnd && remindAtUtc >= nowUtc.minus({ days: 1 })) {
        toDispatch.push({
          occurrenceId: occ.id as string,
          userId,
          ruleId,
          remindAtUtc,
          userTZ: tz,
          payee: rule.payee,
          effectiveDateISO: effectiveDate,
        })
      }
    }

    if (toDispatch.length === 0) {
      return NextResponse.json({
        windowMinutes,
        occurrencesConsidered,
        occurrencesNotified: 0,
        notificationsSent: 0,
        notificationsFailed: 0,
        deactivatedSubscriptions: 0,
      })
    }

    // 6) Send notifications
    let notificationsSent = 0
    let notificationsFailed = 0
    const deactivated: string[] = []

    // Group dispatch items by user for efficient subscription fanout
    const itemsByUser = new Map<string, DispatchItem[]>()
    for (const item of toDispatch) {
      if (!itemsByUser.has(item.userId)) itemsByUser.set(item.userId, [])
      itemsByUser.get(item.userId)!.push(item)
    }

    const successfulOccurrenceIds = new Set<string>()

    for (const [userId, items] of itemsByUser.entries()) {
      const userSubs = subsByUser.get(userId) || []

      for (const item of items) {
        const payload = buildNotificationPayload({
          occurrenceId: item.occurrenceId,
          ruleId: item.ruleId,
          dueDate: item.effectiveDateISO,
          userTZ: item.userTZ,
          payee: item.payee,
        })

        const results = await Promise.allSettled(
          userSubs.map(async (s) => {
            const subscription = {
              endpoint: s.endpoint,
              expirationTime: s.expiration_time ? new Date(s.expiration_time).getTime() : null,
              keys: { p256dh: s.p256dh, auth: s.auth },
            }
            try {
              await webPush.sendNotification(subscription as any, payload)
              return { ok: true as const, subId: s.id }
            } catch (err: any) {
              // Deactivate subscriptions that are gone/invalid
              const status = err?.statusCode || err?.status || 0
              const shouldDeactivate = status === 404 || status === 410
              return { ok: false as const, subId: s.id, shouldDeactivate }
            }
          })
        )

        let anySuccess = false
        for (const r of results) {
          if (r.status === 'fulfilled') {
            if (r.value.ok) {
              notificationsSent += 1
              anySuccess = true
            } else {
              notificationsFailed += 1
              if (r.value.shouldDeactivate) deactivated.push(r.value.subId)
            }
          } else {
            notificationsFailed += 1
          }
        }

        if (anySuccess) successfulOccurrenceIds.add(item.occurrenceId)
      }
    }

    // 7) Persist reminder_sent_at for successfully notified occurrences
    const nowIso = nowUtc.toISO()
    if (successfulOccurrenceIds.size > 0) {
      const { error: updErr } = await supabaseAdmin
        .from('recurring_occurrences')
        .update({ reminder_sent_at: nowIso })
        .in('id', Array.from(successfulOccurrenceIds))
      if (updErr) {
        // Log silently; do not fail whole job
        // eslint-disable-next-line no-console
        console.error('Failed to mark reminder_sent_at:', updErr)
      }
    }

    // 8) Deactivate dead subscriptions
    let deactivatedCount = 0
    if (deactivated.length > 0) {
      const { error: deactErr, count } = await supabaseAdmin
        .from('push_subscriptions')
        .update({ is_active: false })
        .in('id', deactivated)
        .select('*', { count: 'exact', head: true })
      if (deactErr) {
        // eslint-disable-next-line no-console
        console.error('Failed to deactivate subscriptions:', deactErr)
      } else if (typeof count === 'number') {
        deactivatedCount = count
      }
    }

    return NextResponse.json({
      windowMinutes,
      occurrencesConsidered,
      occurrencesNotified: successfulOccurrenceIds.size,
      notificationsSent,
      notificationsFailed,
      deactivatedSubscriptions: deactivatedCount,
    })
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error('Dispatch error:', e)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
