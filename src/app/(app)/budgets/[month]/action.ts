"use server";

import { headers } from "next/headers";

export async function acknowledgeBudgetAlert(input: { month: string; category_id: string | null; status: 'ok' | 'approaching' | 'exceeded' | 'no_budget' }) {
  if (!input || !input.month || !input.status) {
    throw new Error("Invalid input");
  }
  // Only acknowledge actionable alerts
  if (input.status !== 'approaching' && input.status !== 'exceeded') {
    return { ok: true };
  }

  const h = headers();
  const origin = h.get("origin");
  const host = h.get("host");
  const isDev = process.env.NODE_ENV !== "production";
  const base = origin ?? (host ? `${isDev ? 'http' : 'https'}://${host}` : "");
  if (!base) throw new Error("Cannot resolve request origin");

  const res = await fetch(`${base}/api/alerts/budgets/acknowledge`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ month: input.month, category_id: input.category_id, status: input.status }),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "Failed to acknowledge alert");
  }
  return { ok: true };
}
