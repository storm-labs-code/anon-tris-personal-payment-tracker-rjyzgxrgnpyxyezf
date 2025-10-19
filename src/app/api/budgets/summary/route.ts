/**
 * CODE INSIGHT
 * This code's use case is to serve a monthly budget vs. spend summary for the authenticated user.
 * This code's full epic context is the Budgets Overview aggregation endpoint powering /budgets/[month] views, using Supabase tables for overall and per-category budgets and transactions within the month window.
 * This code's ui feel is data-focused and efficient: fast, accurate JSON aggregation enabling responsive progress bars and alerts in the client.
 */

import { NextResponse } from 'next/server'
import { supabaseServer } from '@/utils/supabase/client-server'

export async function GET(req: Request) {
  try {
    const { data: authData, error: authError } = await supabaseServer.auth.getUser()
    if (authError || !authData?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = authData.user.id

    const url = new URL(req.url)
    const monthParam = url.searchParams.get('month')

    if (!monthParam || !/^\d{4}-\d{2}$/.test(monthParam)) {
      return NextResponse.json({ error: 'Invalid or missing month. Expected format YYYY-MM' }, { status: 400 })
    }

    const [yearStr, monthStr] = monthParam.split('-')
    const year = Number(yearStr)
    const monthIdx = Number(monthStr) - 1
    if (Number.isNaN(year) || Number.isNaN(monthIdx) || monthIdx < 0 || monthIdx > 11) {
      return NextResponse.json({ error: 'Invalid month value' }, { status: 400 })
    }

    // Compute period range in UTC
    const monthStart = new Date(Date.UTC(year, monthIdx, 1, 0, 0, 0, 0))
    const nextMonthStart = new Date(Date.UTC(year, monthIdx + 1, 1, 0, 0, 0, 0))
    const monthStartDateStr = monthStart.toISOString().slice(0, 10) // YYYY-MM-DD for date columns
    const monthStartIso = monthStart.toISOString()
    const nextMonthStartIso = nextMonthStart.toISOString()

    const DEFAULT_THRESHOLD = 80

    // Fetch budgets (overall + categories)
    const [catBudgetsRes, overallBudgetRes] = await Promise.all([
      supabaseServer
        .from('category_budgets')
        .select('category_id, amount, alert_threshold_percent')
        .eq('user_id', userId)
        .eq('period_start', monthStartDateStr),
      supabaseServer
        .from('overall_budgets')
        .select('amount, alert_threshold_percent')
        .eq('user_id', userId)
        .eq('period_start', monthStartDateStr)
        .maybeSingle(),
    ])

    if (catBudgetsRes.error) {
      return NextResponse.json({ error: catBudgetsRes.error.message }, { status: 500 })
    }
    if (overallBudgetRes.error) {
      return NextResponse.json({ error: overallBudgetRes.error.message }, { status: 500 })
    }

    const categoryBudgets = (catBudgetsRes.data ?? []).map((r) => ({
      category_id: r.category_id as string,
      amount: Number(r.amount ?? 0),
      threshold: typeof r.alert_threshold_percent === 'number' ? r.alert_threshold_percent : DEFAULT_THRESHOLD,
    }))

    const overallBudgetAmount = overallBudgetRes.data ? Number(overallBudgetRes.data.amount ?? 0) : null
    const overallThreshold = overallBudgetRes.data?.alert_threshold_percent ?? null

    // Fetch transactions for the month and aggregate on server side (safe if data size is reasonable)
    const txRes = await supabaseServer
      .from('transactions')
      .select('category_id, amount, occurred_at')
      .eq('user_id', userId)
      .gte('occurred_at', monthStartIso)
      .lt('occurred_at', nextMonthStartIso)
      .gt('amount', 0)

    if (txRes.error) {
      return NextResponse.json({ error: txRes.error.message }, { status: 500 })
    }

    const txs = txRes.data ?? []

    // Aggregate spend
    let overallSpent = 0
    const spendByCategory = new Map<string, number>()

    for (const t of txs) {
      const amt = Number((t as any).amount ?? 0)
      overallSpent += amt
      const cid = (t as any).category_id as string | null
      if (cid) {
        spendByCategory.set(cid, (spendByCategory.get(cid) ?? 0) + amt)
      }
    }

    // Determine category set (union of budgeted categories and categories with spend)
    const categoryIds = new Set<string>()
    for (const b of categoryBudgets) categoryIds.add(b.category_id)
    for (const cid of spendByCategory.keys()) categoryIds.add(cid)

    // Fetch category names for those ids (if any)
    let categoryNameMap = new Map<string, string>()
    if (categoryIds.size > 0) {
      const catRes = await supabaseServer
        .from('categories')
        .select('id, name')
        .eq('user_id', userId)
        .in('id', Array.from(categoryIds))

      if (catRes.error) {
        return NextResponse.json({ error: catRes.error.message }, { status: 500 })
      }
      categoryNameMap = new Map((catRes.data ?? []).map((c: any) => [c.id as string, c.name as string]))
    }

    // Index budgets by category
    const budgetByCategory = new Map<string, { amount: number; threshold: number }>()
    for (const b of categoryBudgets) {
      budgetByCategory.set(b.category_id, { amount: b.amount, threshold: b.threshold })
    }

    // Helper to compute status and percent
    function computeStatus(spent: number, budget: number | null, threshold: number): { percent: number | null; status: 'ok' | 'approaching' | 'exceeded' | null; remaining: number | null } {
      if (budget === null || typeof budget !== 'number') {
        return { percent: null, status: null, remaining: null }
      }
      if (budget <= 0) {
        const status = spent > 0 ? 'exceeded' : 'ok'
        const percent = spent > 0 ? 100 : 0
        const remaining = 0 - spent
        return { percent, status, remaining }
      }
      const percentRaw = (spent / budget) * 100
      const percent = Math.round(percentRaw * 10) / 10
      const remaining = budget - spent
      if (percent >= 100) return { percent, status: 'exceeded', remaining }
      if (percent >= threshold) return { percent, status: 'approaching', remaining }
      return { percent, status: 'ok', remaining }
    }

    // Build category rows
    const categoryThresholdsUsed: Record<string, number> = {}
    const categories: Array<{
      category_id: string
      category_name: string
      budget_amount: number | null
      spent: number
      remaining: number | null
      percent: number | null
      status: 'ok' | 'approaching' | 'exceeded' | null
      threshold_pct_used: number | null
    }> = []

    for (const cid of Array.from(categoryIds)) {
      const name = categoryNameMap.get(cid) ?? 'Unknown'
      const spent = spendByCategory.get(cid) ?? 0
      const budgetEntry = budgetByCategory.get(cid)
      const budgetAmount = budgetEntry ? budgetEntry.amount : null
      const threshold = budgetEntry ? budgetEntry.threshold : DEFAULT_THRESHOLD
      const { percent, status, remaining } = computeStatus(spent, budgetAmount, threshold)
      if (budgetEntry) {
        categoryThresholdsUsed[cid] = threshold
      }
      categories.push({
        category_id: cid,
        category_name: name,
        budget_amount: budgetAmount,
        spent,
        remaining,
        percent,
        status,
        threshold_pct_used: budgetEntry ? threshold : null,
      })
    }

    // Sort categories by name for consistent ordering
    categories.sort((a, b) => a.category_name.localeCompare(b.category_name, 'ko'))

    // Overall summary
    const overallThresholdUsed = overallThreshold ?? DEFAULT_THRESHOLD
    const overall = (() => {
      const { percent, status, remaining } = computeStatus(overallSpent, overallBudgetAmount, overallThresholdUsed)
      return {
        budget_amount: overallBudgetAmount,
        spent: overallSpent,
        remaining,
        percent,
        status,
        threshold_pct_used: overallBudgetAmount !== null ? overallThresholdUsed : null,
      }
    })()

    const payload = {
      month: monthParam,
      overall,
      categories,
      thresholds_used: {
        default: DEFAULT_THRESHOLD,
        overall: overallThresholdUsed,
        categories: categoryThresholdsUsed,
      },
      period: {
        start: monthStartIso,
        end_exclusive: nextMonthStartIso,
      },
    }

    return NextResponse.json(payload, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ error: 'Unexpected error', detail: err?.message ?? String(err) }, { status: 500 })
  }
}
