import Link from "next/link";
import { redirect } from "next/navigation";
import Client from "./client";

/**
 * CODE INSIGHT
 * This code's use case is to render the Budgets Overview for a specific month under /budgets/[month].
 * This code's full epic context is the Budgets Overview page that fetches a monthly summary from /api/budgets/summary, displays overall and per-category progress, and surfaces alerts with acknowledge actions.
 * This code's ui feel is clean, modern, and mobile-first with calm, confident interactions and accessible, minimal visuals aligned to Tris branding.
 */

function getCurrentMonthYYYYMM(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function isValidMonthParam(input: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(input)) return false;
  const [y, m] = input.split("-").map(Number);
  if (y < 1970 || y > 2100) return false;
  if (m < 1 || m > 12) return false;
  return true;
}

export default async function Page({ params }: { params: { month: string } }) {
  const month = params?.month;
  if (!month || !isValidMonthParam(month)) {
    redirect(`/budgets/${getCurrentMonthYYYYMM()}`);
  }

  return (
    <main className="w-full">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <Client month={month} />
      </div>
    </main>
  );
}
