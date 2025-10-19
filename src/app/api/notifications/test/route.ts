/**
 * CODE INSIGHT
 * This code's use case is to send a one-off test web push notification to the current authenticated user's latest active push subscription.
 * This code's full epic context is the Notifications flow for Tris, where users can enable push and verify delivery via a test endpoint.
 * This code's ui feel is server-side only; it returns clear JSON results for the client UI to surface success or actionable error messages.
 */

import { NextResponse } from 'next/server'
import webpush from 'web-push'
import { supabaseServer } from '@/utils/supabase/client-server'

export const runtime = 'nodejs'

export async function POST() {
  try {
    const { data: authData, error: authError } = await supabaseServer.auth.getUser()
    if (authError) {
      return NextResponse.json({ error: 'Failed to verify session.' }, { status: 401 })
    }
    const user = authData?.user
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
    }

    const publicKey = process.env.VAPID_PUBLIC_KEY
    const privateKey = process.env.VAPID_PRIVATE_KEY
    const subject = process.env.VAPID_SUBJECT || `mailto:${process.env.NOTIFICATIONS_EMAIL || 'support@tris.app'}`

    if (!publicKey || !privateKey) {
      return NextResponse.json(
        { error: 'Push not configured on server. Missing VAPID keys.' },
        { status: 500 }
      )
    }

    // Fetch the latest active subscription for the user
    const { data: sub, error: subErr } = await supabaseServer
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth, expiration_time, is_active, created_at')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (subErr) {
      return NextResponse.json({ error: 'Unable to load push subscription.' }, { status: 500 })
    }

    if (!sub) {
      return NextResponse.json(
        { error: 'No active push subscription found. Enable push notifications first.' },
        { status: 400 }
      )
    }

    webpush.setVapidDetails(subject, publicKey, privateKey)

    const payload = JSON.stringify({
      title: 'Tris — Test notification',
      body: 'Push is working. Tap to open Upcoming.',
      url: '/upcoming',
      tag: 'tris-test',
      badge: '/icons/badge-72x72.png',
      icon: '/icons/icon-192x192.png',
      timestamp: Date.now(),
    })

    const subscription = {
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.p256dh,
        auth: sub.auth,
      },
    }

    const response = await webpush
      .sendNotification(subscription as any, payload, { TTL: 60 })
      .catch(async (err: any) => {
        // Handle expired/invalid subscriptions and mark inactive
        const statusCode = err?.statusCode || err?.status || 500
        if (statusCode === 404 || statusCode === 410) {
          await supabaseServer
            .from('push_subscriptions')
            .update({ is_active: false })
            .eq('id', sub.id)
          throw new Error('Subscription expired or revoked. Please re-enable push notifications.')
        }
        throw err
      })

    return NextResponse.json({
      ok: true,
      message: 'Test notification sent.',
      subscriptionId: sub.id,
      endpoint: sub.endpoint,
      result: {
        statusCode: (response as any)?.statusCode ?? 201,
      },
    })
  } catch (e: any) {
    const msg = e?.message || 'Failed to send test notification.'
    const status = /expired|revoked|re-enable/i.test(msg) ? 400 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
