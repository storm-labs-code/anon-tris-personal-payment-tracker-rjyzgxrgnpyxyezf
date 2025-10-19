/**
 * CODE INSIGHT
 * This code's use case is to serve demo financial summary data for the Reports page.
 * This code's full epic context is the /api/demo/* mock endpoints that power client-side SWR fetching,
 * offline caching, and charts on the Reports view with adjustable ranges (7/30/90 days).
 * The UI feel is responsive and reliable with optional delay and error simulation to test loading and error states.
 */

import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const search = url.searchParams

    const rangeParam = search.get('range')
    const delayParam = search.get('delay')
    const errorParam = search.get('error')
    const seedParam = search.get('seed')

    const allowedRanges = new Set([7, 30, 90])
    let rangeDays = Number(rangeParam ?? 30)
    if (!allowedRanges.has(rangeDays)) rangeDays = 30

    const delay = Math.max(0, Math.min(10000, Number(delayParam ?? 0)))

    if (errorParam === '1') {
      if (delay) await new Promise((r) => setTimeout(r, delay))
      return NextResponse.json(
        { error: 'Simulated error', code: 'SIMULATED_ERROR' },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    if (delay) await new Promise((r) => setTimeout(r, delay))

    const now = new Date()
    // End date is today (local date boundary in ISO date form)
    const endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const startDate = new Date(endDate)
    startDate.setUTCDate(endDate.getUTCDate() - (rangeDays - 1))

    // Seeded PRNG for stable demo output in a given period
    function createPRNG(seedStr: string) {
      let seed = 2166136261 >>> 0
      for (let i = 0; i < seedStr.length; i++) {
        seed ^= seedStr.charCodeAt(i)
        seed = Math.imul(seed, 16777619) >>> 0
      }
      return function rnd() {
        // LCG
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
        return (seed & 0xffffffff) / 0x100000000
      }
    }

    const seedBase = seedParam || `${startDate.toISOString().slice(0, 10)}:${rangeDays}:tris-demo`
    const rnd = createPRNG(seedBase)

    // Category setup with base weights for distribution
    const categories = [
      { name: '식비', key: 'food', weight: 0.28, color: '#60a5fa' }, // Food & Dining
      { name: '교통', key: 'transport', weight: 0.12, color: '#34d399' }, // Transport
      { name: '공과금', key: 'bills', weight: 0.18, color: '#fbbf24' }, // Bills & Utilities
      { name: '쇼핑', key: 'shopping', weight: 0.16, color: '#f472b6' }, // Shopping
      { name: '건강', key: 'health', weight: 0.10, color: '#a78bfa' }, // Health
      { name: '여가', key: 'entertainment', weight: 0.10, color: '#f87171' }, // Entertainment
      { name: '기타', key: 'other', weight: 0.06, color: '#94a3b8' }, // Other
    ]

    // Normalize weights
    const weightSum = categories.reduce((s, c) => s + c.weight, 0)
    categories.forEach((c) => (c.weight = c.weight / weightSum))

    // Base spend per day (KRW) with realistic variance and weekly pattern
    const baseDaily = 85000 + Math.floor(rnd() * 25000) // 85k ~ 110k

    const series: { date: string; amount: number }[] = []
    const byCategoryMap = new Map<string, number>()
    categories.forEach((c) => byCategoryMap.set(c.key, 0))

    let highestDay = { date: '', amount: -Infinity }
    let lowestDay = { date: '', amount: Infinity }

    for (let i = 0; i < rangeDays; i++) {
      const d = new Date(startDate)
      d.setUTCDate(startDate.getUTCDate() + i)
      const isoDate = d.toISOString().slice(0, 10)

      // Weekly rhythm: weekends slightly higher spend, Mondays slightly lower
      const day = d.getUTCDay() // 0 Sun..6 Sat
      const weekendBoost = day === 0 || day === 6 ? 1.2 : 1
      const mondayDip = day === 1 ? 0.9 : 1

      // Random variance with mild trend
      const noise = (rnd() - 0.5) * 0.35 // +/-35%
      const trend = 1 + ((i - rangeDays / 2) / rangeDays) * 0.05 // gentle +/-2.5%

      let amount = Math.max(
        0,
        Math.round(baseDaily * weekendBoost * mondayDip * (1 + noise) * trend)
      )

      // Ensure some zero or low-spend days for realism
      if (rnd() < 0.05) amount = Math.round(amount * 0.2)

      series.push({ date: isoDate, amount })

      if (amount > highestDay.amount) highestDay = { date: isoDate, amount }
      if (amount < lowestDay.amount) lowestDay = { date: isoDate, amount }

      // Distribute per-day spend across categories with jitter
      let remaining = amount
      const allocations: number[] = []
      categories.forEach((c, idx) => {
        // Last category gets the remainder to keep total consistent
        if (idx === categories.length - 1) {
          allocations.push(Math.max(0, remaining))
        } else {
          const jitter = 0.75 + rnd() * 0.5 // 0.75..1.25
          const portion = Math.round(amount * c.weight * jitter)
          allocations.push(portion)
          remaining -= portion
        }
      })
      categories.forEach((c, idx) => {
        byCategoryMap.set(c.key, (byCategoryMap.get(c.key) || 0) + allocations[idx])
      })
    }

    const totalSpend = series.reduce((s, d) => s + d.amount, 0)
    const dailyAverage = Math.round(totalSpend / rangeDays)

    // Moving average (7-day) for charts
    const windowSize = 7
    const movingAverage: { date: string; amount: number }[] = []
    for (let i = 0; i < series.length; i++) {
      const start = Math.max(0, i - windowSize + 1)
      const slice = series.slice(start, i + 1)
      const avg = Math.round(slice.reduce((s, d) => s + d.amount, 0) / slice.length)
      movingAverage.push({ date: series[i].date, amount: avg })
    }

    const byCategory = categories.map((c) => {
      const total = byCategoryMap.get(c.key) || 0
      const share = totalSpend > 0 ? total / totalSpend : 0
      return { name: c.name, key: c.key, total, share, color: c.color }
    })

    // Determine top category
    const top = byCategory.reduce(
      (acc, c) => (c.total > acc.total ? c : acc),
      { name: '', key: '', total: -1, share: 0, color: '' }
    )

    const body = {
      success: true,
      meta: {
        rangeDays,
        currency: 'KRW',
        locale: 'ko-KR',
        periodStart: startDate.toISOString().slice(0, 10),
        periodEnd: endDate.toISOString().slice(0, 10),
        generatedAt: new Date().toISOString(),
      },
      totals: {
        totalSpend,
        dailyAverage,
        highestDay,
        lowestDay,
        topCategory: { name: top.name, key: top.key, total: top.total, share: top.share },
      },
      byCategory,
      series,
      movingAverage,
    }

    return NextResponse.json(body, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=600',
      },
    })
  } catch (err) {
    return NextResponse.json(
      { error: 'Unexpected error', code: 'UNEXPECTED' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
