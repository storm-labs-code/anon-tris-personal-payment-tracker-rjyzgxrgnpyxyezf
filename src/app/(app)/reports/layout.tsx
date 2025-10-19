/**
 * CODE INSIGHT
 * This code's use case is to provide a shared sub-layout for all /reports pages, delivering a consistent, mobile-first shell with a sticky filter toolbar, persistent bottom navigation, and a floating action button for quick transaction entry.
 * This code's full epic context is the Reports feature where filter state is encoded via URL search params and used across Overview, Categories, and Trends pages. The layout ensures simple navigation and form-based URL updates without fetching report data itself.
 * This code's ui feel is clean, calm, and modern with a focus on quick accessibility: sticky controls, large touch targets, and clear visual hierarchy following the project's Tailwind theme.
 */

import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/utils/supabase/client-server";

export const dynamic = "force-dynamic";

export default async function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const {
    data: { user },
    error: authError,
  } = await supabaseServer.auth.getUser();

  if (!user || authError) {
    redirect("/signin");
  }

  const { data: categories, error: categoriesError } = await supabaseServer
    .from("categories")
    .select("id, name, is_favorite")
    .eq("user_id", user.id)
    .order("is_favorite", { ascending: false })
    .order("name", { ascending: true });

  const methods = [
    { value: "", label: "All methods" },
    { value: "card", label: "Card" },
    { value: "cash", label: "Cash" },
    { value: "bank", label: "Bank" },
    { value: "mobile", label: "Mobile" },
    { value: "transfer", label: "Transfer" },
  ];

  return (
    <div className="min-h-dvh bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="px-4 pt-3 pb-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-full h-9 w-9 bg-primary text-primary-foreground shadow-sm"
              aria-label="Go to Dashboard"
            >
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0h6" />
              </svg>
            </Link>
            <div>
              <h1 className="text-base font-semibold leading-tight">Reports</h1>
              <p className="text-xs text-muted-foreground">Analyze your spend in KRW</p>
            </div>
          </div>
          <Link
            href="/transactions/new"
            className="hidden sm:inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-4 py-2 text-sm font-medium shadow-sm hover:brightness-110 transition"
          >
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add
          </Link>
        </div>

        <div className="px-4 pb-3">
          <form method="GET" action="." className="rounded-xl border bg-card text-card-foreground p-3 shadow-sm">
            <input type="hidden" name="tz" value="Asia/Seoul" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="flex flex-col gap-1">
                <label htmlFor="start" className="text-xs text-muted-foreground">
                  Start date
                </label>
                <input
                  id="start"
                  name="start"
                  type="date"
                  className="h-10 px-3 rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="end" className="text-xs text-muted-foreground">
                  End date
                </label>
                <input
                  id="end"
                  name="end"
                  type="date"
                  className="h-10 px-3 rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="flex flex-col gap-1 col-span-2 sm:col-span-1">
                <label htmlFor="method" className="text-xs text-muted-foreground">
                  Method
                </label>
                <select
                  id="method"
                  name="method"
                  className="h-10 px-3 rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  defaultValue=""
                >
                  {methods.map((m) => (
                    <option key={m.value || "all"} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1 col-span-2 sm:col-span-2">
                <label htmlFor="categoryId" className="text-xs text-muted-foreground">
                  Categories
                </label>
                <select
                  id="categoryId"
                  name="categoryId"
                  multiple
                  className="min-h-10 h-10 sm:h-[42px] px-3 rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 overflow-y-auto"
                >
                  {categoriesError ? (
                    <option value="" disabled>
                      Unable to load categories
                    </option>
                  ) : (categories || []).length === 0 ? (
                    <option value="" disabled>
                      No categories yet
                    </option>
                  ) : (
                    (categories || []).map((c: { id: string; name: string; is_favorite: boolean }) => (
                      <option key={c.id} value={c.id}>
                        {c.is_favorite ? "★ " : ""}
                        {c.name}
                      </option>
                    ))
                  )}
                </select>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Tip: Hold Ctrl/Cmd to select multiple
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 justify-end">
              <a
                href="?"
                className="inline-flex items-center rounded-md border px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition"
              >
                Clear
              </a>
              <button
                type="submit"
                className="inline-flex items-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium shadow hover:brightness-110 transition"
              >
                Apply
              </button>
            </div>
          </form>
        </div>

        <div className="px-4 pb-3">
          <nav className="grid grid-cols-3 gap-2" aria-label="Reports sections">
            <Link
              href="/reports/overview"
              className="inline-flex items-center justify-center rounded-full border px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition"
            >
              Overview
            </Link>
            <Link
              href="/reports/categories"
              className="inline-flex items-center justify-center rounded-full border px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition"
            >
              Categories
            </Link>
            <Link
              href="/reports/trends"
              className="inline-flex items-center justify-center rounded-full border px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition"
            >
              Trends
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 pb-28 px-4 pt-3 sm:pt-4">{children}</main>

      <Link
        href="/transactions/new"
        className="fixed bottom-20 right-4 sm:right-6 z-40 inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-5 py-3 shadow-lg hover:brightness-110 active:scale-95 transition"
        aria-label="Add transaction"
      >
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
        New
      </Link>

      <nav
        className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 border-t z-30"
        aria-label="Primary reports navigation"
      >
        <ul className="grid grid-cols-3">
          <li>
            <Link
              href="/reports/overview"
              className="flex flex-col items-center justify-center py-3 text-sm hover:text-primary transition"
            >
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                className="h-5 w-5 mb-1"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 3v18h18" />
                <path d="M7 13l3 3 7-7" />
              </svg>
              Overview
            </Link>
          </li>
          <li>
            <Link
              href="/reports/categories"
              className="flex flex-col items-center justify-center py-3 text-sm hover:text-primary transition"
            >
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                className="h-5 w-5 mb-1"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              Categories
            </Link>
          </li>
          <li>
            <Link
              href="/reports/trends"
              className="flex flex-col items-center justify-center py-3 text-sm hover:text-primary transition"
            >
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                className="h-5 w-5 mb-1"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 17l6-6 4 4 7-7" />
              </svg>
              Trends
            </Link>
          </li>
        </ul>
        <div className="pb-[env(safe-area-inset-bottom)]" />
      </nav>
    </div>
  );
}
