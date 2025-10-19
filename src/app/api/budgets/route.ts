/**
 * CODE INSIGHT
 * This code's use case is to provide a single API endpoint for managing monthly budgets.
 * This code's full epic context is the Budgets epic: listing, batch upserting, and deleting monthly budgets,
 * normalizing inputs to first-of-month and constraining all operations to the authenticated user via Supabase RLS.
 * This code's ui feel is irrelevant (API); it focuses on predictable, validated JSON responses for the editor and overview pages.
 */

import { NextResponse } from 'next/server';
import { supabaseServer } from '@/utils/supabase/client-server';

// Types representing unified response rows
interface UnifiedBudgetRow {
  id: string;
  user_id: string;
  month: string; // YYYY-MM
  category_id: string | null;
  amount: number;
  threshold_pct: number;
  created_at?: string;
  updated_at?: string;
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function ensureAuth = async () => {
  const { data, error } = await supabaseServer.auth.getUser();
  if (error || !data?.user) return { userId: null as string | null, error: error?.message ?? 'Unauthorized' };
  return { userId: data.user.id as string, error: null as string | null };
};

function isValidMonthStr(month: string | null): month is string {
  return !!month && /^\d{4}-\d{2}$/.test(month);
}

function monthToPeriodStart(month: string): string {
  // month is YYYY-MM, produce YYYY-MM-01
  const [y, m] = month.split('-').map(Number);
  const yyyy = y.toString().padStart(4, '0');
  const mm = m.toString().padStart(2, '0');
  return `${yyyy}-${mm}-01`;
}

function clampThreshold(value: number | undefined | null): number {
  const v = Number.isFinite(value as number) ? Number(value) : 80;
  // Editor intends 50–100%; keep server defensive
  return Math.min(100, Math.max(50, Math.round(v)));
}

function normalizeAmountKRW(amount: unknown): number {
  const n = Number(amount);
  if (!Number.isFinite(n) || n < 0) throw new Error('Invalid amount; must be a non-negative number');
  // Store as integer KRW (schema uses bigint)
  return Math.round(n);
}

function mapCategoryBudgetRow(row: any): UnifiedBudgetRow {
  return {
    id: row.id,
    user_id: row.user_id,
    month: row.period_start?.slice(0, 7),
    category_id: row.category_id,
    amount: Number(row.amount ?? 0),
    threshold_pct: Number(row.alert_threshold_percent ?? 80),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapOverallBudgetRow(row: any): UnifiedBudgetRow {
  return {
    id: row.id,
    user_id: row.user_id,
    month: row.period_start?.slice(0, 7),
    category_id: null,
    amount: Number(row.amount ?? 0),
    threshold_pct: Number(row.alert_threshold_percent ?? 80),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function GET(req: Request) {
  const { userId, error: authErr } = await ensureAuth();
  if (!userId) return jsonError(authErr ?? 'Unauthorized', 401);

  const url = new URL(req.url);
  const month = url.searchParams.get('month');
  if (!isValidMonthStr(month)) return jsonError("Invalid or missing 'month'. Expected YYYY-MM.");

  const periodStart = monthToPeriodStart(month);

  // Fetch category and overall budgets for the user + period
  const [catRes, overallRes] = await Promise.all([
    supabaseServer
      .from('category_budgets')
      .select('*')
      .eq('user_id', userId)
      .eq('period_start', periodStart),
    supabaseServer
      .from('overall_budgets')
      .select('*')
      .eq('user_id', userId)
      .eq('period_start', periodStart),
  ]);

  if (catRes.error) return jsonError(catRes.error.message, 500);
  if (overallRes.error) return jsonError(overallRes.error.message, 500);

  const payload: UnifiedBudgetRow[] = [
    ...(catRes.data ?? []).map(mapCategoryBudgetRow),
    ...(overallRes.data ?? []).map(mapOverallBudgetRow),
  ];

  return NextResponse.json({ month, period_start: periodStart, budgets: payload });
}

export async function PUT(req: Request) {
  const { userId, error: authErr } = await ensureAuth();
  if (!userId) return jsonError(authErr ?? 'Unauthorized', 401);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON body.');
  }

  const month: string | null = body?.month ?? null;
  const budgets: any[] = Array.isArray(body?.budgets) ? body.budgets : [];
  if (!isValidMonthStr(month)) return jsonError("Invalid or missing 'month'. Expected YYYY-MM.");
  if (!Array.isArray(budgets) || budgets.length === 0) return jsonError("Invalid or missing 'budgets'. Expected non-empty array.");

  const periodStart = monthToPeriodStart(month);

  // Normalize and validate payload
  const normalized = budgets.map((b, idx) => {
    const categoryId = b?.category_id ?? null;
    if (categoryId !== null && (typeof categoryId !== 'string' || categoryId.length === 0)) {
      throw new Error(`budgets[${idx}].category_id must be string or null`);
    }
    const amount = normalizeAmountKRW(b?.amount);
    const threshold = clampThreshold(b?.threshold_pct);
    return { category_id: categoryId as string | null, amount, threshold_pct: threshold };
  });

  // Split into category budgets and overall budget entries
  const catRows = normalized
    .filter((r) => r.category_id)
    .map((r) => ({
      user_id: userId,
      category_id: r.category_id as string,
      period_start: periodStart,
      amount: r.amount,
      alert_threshold_percent: r.threshold_pct,
    }));

  const overallRows = normalized
    .filter((r) => r.category_id === null)
    .map((r) => ({
      user_id: userId,
      period_start: periodStart,
      amount: r.amount,
      alert_threshold_percent: r.threshold_pct,
    }));

  // Perform upserts
  const results: UnifiedBudgetRow[] = [];

  if (catRows.length > 0) {
    const { data, error } = await supabaseServer
      .from('category_budgets')
      .upsert(catRows, { onConflict: 'user_id,period_start,category_id' })
      .select('*');
    if (error) return jsonError(error.message, 500);
    results.push(...(data ?? []).map(mapCategoryBudgetRow));
  }

  if (overallRows.length > 0) {
    const { data, error } = await supabaseServer
      .from('overall_budgets')
      .upsert(overallRows, { onConflict: 'user_id,period_start' })
      .select('*');
    if (error) return jsonError(error.message, 500);
    results.push(...(data ?? []).map(mapOverallBudgetRow));
  }

  return NextResponse.json({ month, period_start: periodStart, budgets: results });
}

export async function DELETE(req: Request) {
  const { userId, error: authErr } = await ensureAuth();
  if (!userId) return jsonError(authErr ?? 'Unauthorized', 401);

  // Prefer explicit IDs if provided; otherwise require month param
  const url = new URL(req.url);
  const month = url.searchParams.get('month');

  let ids: string[] | null = null;
  try {
    const body = await req.json().catch(() => null);
    if (body && Array.isArray(body.ids)) ids = body.ids.filter((v: any) => typeof v === 'string' && v.length > 0);
  } catch {
    // Ignore body parse errors; proceed with month-based delete
  }

  if (ids && ids.length > 0) {
    const [catDel, overallDel] = await Promise.all([
      supabaseServer.from('category_budgets').delete().in('id', ids).eq('user_id', userId),
      supabaseServer.from('overall_budgets').delete().in('id', ids).eq('user_id', userId),
    ]);

    if (catDel.error) return jsonError(catDel.error.message, 500);
    if (overallDel.error) return jsonError(overallDel.error.message, 500);

    const deletedCount = (catDel.count ?? 0) + (overallDel.count ?? 0);
    return NextResponse.json({ success: true, deleted: { category_count: catDel.count ?? null, overall_count: overallDel.count ?? null, total: deletedCount } });
  }

  if (!isValidMonthStr(month)) return jsonError("Invalid or missing 'month'. Expected YYYY-MM when no ids provided.");
  const periodStart = monthToPeriodStart(month);

  const [catDel, overallDel] = await Promise.all([
    supabaseServer.from('category_budgets').delete().eq('user_id', userId).eq('period_start', periodStart),
    supabaseServer.from('overall_budgets').delete().eq('user_id', userId).eq('period_start', periodStart),
  ]);

  if (catDel.error) return jsonError(catDel.error.message, 500);
  if (overallDel.error) return jsonError(overallDel.error.message, 500);

  return NextResponse.json({ success: true, month, period_start: periodStart });
}
