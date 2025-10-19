/**
 * CODE INSIGHT
 * This code's use case is to manage Web Push subscriptions for the authenticated user.
 * This code's full epic context is the Notifications flow where enabling/disabling push stores
 * device subscriptions in the push_subscriptions table and drives reminder delivery.
 * This code's ui feel is irrelevant (API-only), but the responses are concise and robust for production.
 */

import { NextResponse } from 'next/server'
import { supabaseServer } from '@/utils/supabase/client-server'

interface SubscriptionPayload {
  endpoint?: string
  keys?: {
    p256dh?: string
    auth?: string
  }
  expirationTime?: number | null
}

async function getUserId() {
  const { data, error } = await supabaseServer.auth.getUser()
  if (error || !data?.user) return null
  return data.user.id
}

function parseExpiration(expirationTime: number | null | undefined): string | null {
  if (!expirationTime && expirationTime !== 0) return null
  try {
    const d = new Date(expirationTime as number)
    if (isNaN(d.getTime())) return null
    return d.toISOString()
  } catch {
    return null
  }
}

export async function POST(req: Request) {
  try {
    const userId = await getUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: SubscriptionPayload | null = null
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const endpoint = body?.endpoint?.trim()
    const p256dh = body?.keys?.p256dh?.trim()
    const authKey = body?.keys?.auth?.trim()
    const expiration_time = parseExpiration(body?.expirationTime)

    if (!endpoint || !p256dh || !authKey) {
      return NextResponse.json(
        { error: 'Missing required subscription fields: endpoint, keys.p256dh, keys.auth' },
        { status: 400 }
      )
    }

    const user_agent = req.headers.get('user-agent') ?? null
    const nowIso = new Date().toISOString()

    // Try find existing subscription by user + endpoint
    const { data: existing, error: findErr } = await supabaseServer
      .from('push_subscriptions')
      .select('id')
      .eq('user_id', userId)
      .eq('endpoint', endpoint)
      .maybeSingle()

    if (findErr) {
      return NextResponse.json({ error: 'Failed to query subscription' }, { status: 500 })
    }

    if (existing?.id) {
      const { error: updateErr } = await supabaseServer
        .from('push_subscriptions')
        .update({
          p256dh,
          auth: authKey,
          expiration_time,
          user_agent,
          is_active: true,
          updated_at: nowIso,
        })
        .eq('id', existing.id)

      if (updateErr) {
        return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 })
      }

      return NextResponse.json({ success: true })
    }

    const { error: insertErr } = await supabaseServer.from('push_subscriptions').insert({
      user_id: userId,
      endpoint,
      p256dh,
      auth: authKey,
      expiration_time,
      user_agent,
      is_active: true,
      updated_at: nowIso,
    })

    if (insertErr) {
      return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: 'Unexpected server error' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const userId = await getUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let endpoint: string | undefined
    try {
      const body = (await req.json()) as SubscriptionPayload
      endpoint = body?.endpoint?.trim()
    } catch {
      // Ignore: body might be empty; we can fallback to user-agent
    }

    const user_agent = req.headers.get('user-agent') ?? undefined
    const nowIso = new Date().toISOString()

    if (endpoint) {
      const { error } = await supabaseServer
        .from('push_subscriptions')
        .update({ is_active: false, updated_at: nowIso })
        .eq('user_id', userId)
        .eq('endpoint', endpoint)

      if (error) {
        return NextResponse.json({ error: 'Failed to remove subscription' }, { status: 500 })
      }
      return NextResponse.json({ success: true })
    }

    if (user_agent) {
      const { error } = await supabaseServer
        .from('push_subscriptions')
        .update({ is_active: false, updated_at: nowIso })
        .eq('user_id', userId)
        .eq('user_agent', user_agent)
        .eq('is_active', true)

      if (error) {
        return NextResponse.json({ error: 'Failed to remove device subscriptions' }, { status: 500 })
      }
      return NextResponse.json({ success: true })
    }

    return NextResponse.json(
      { error: 'Missing endpoint and could not infer device. Provide endpoint in body.' },
      { status: 400 }
    )
  } catch (e) {
    return NextResponse.json({ error: 'Unexpected server error' }, { status: 500 })
  }
}
