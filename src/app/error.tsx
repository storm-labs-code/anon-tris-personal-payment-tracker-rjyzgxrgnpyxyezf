"use client";

/**
 * CODE INSIGHT
 * This code's use case is the global error boundary UI for the App Router. It captures uncaught runtime/render errors and presents
 * an accessible alert with a single-tap recovery flow that feels calm and trustworthy on mobile-first UIs.
 * This code's full epic context is to provide consistent, reliable error handling with clear retry actions and offline guidance,
 * aligning with the PWA and offline-first strategy in Tris. The component respects design tokens and conveys status succinctly.
 * This code's ui feel is clean, minimal, and reassuring with subtle motion, large touch targets, and KR-friendly clarity.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator === "undefined" ? true : navigator.onLine);
  const [retrying, setRetrying] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    console.error("Global error boundary caught: ", error);
  }, [error]);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const message = useMemo(() => {
    if (!isOnline) return "You appear to be offline. Some features may not be available.";
    return error?.message || "An unexpected error occurred.";
  }, [error?.message, isOnline]);

  const handleRetry = () => {
    setRetrying(true);
    // Give the UI a moment to provide feedback, then attempt to recover the route tree
    setTimeout(() => {
      try {
        reset();
      } finally {
        setRetrying(false);
      }
    }, 150);
  };

  return (
    <main className="mx-auto w-full max-w-2xl p-4 sm:p-6">
      <section
        className="relative rounded-2xl border bg-card text-card-foreground shadow-sm ring-1 ring-border/50">
        <div className="p-4 sm:p-6">
          <Alert role="alert" className="border-destructive/40 bg-destructive/10 text-destructive">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-destructive text-destructive-foreground">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="opacity-95">
                  <path d="M12 8v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <circle cx="12" cy="17" r="1" fill="currentColor"/>
                  <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                </svg>
                <span className="sr-only">Error</span>
              </div>
              <div className="flex-1">
                <AlertTitle className="text-base font-semibold">Something went wrong</AlertTitle>
                <AlertDescription className="mt-1 text-sm leading-relaxed">
                  {message}
                </AlertDescription>
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                    <span
                      className={"h-1.5 w-1.5 rounded-full " + (isOnline ? "bg-green-500" : "bg-red-500")}
                      aria-hidden
                    />
                    <span>{isOnline ? "Online" : "Offline"}</span>
                  </span>
                  {error?.digest ? (
                    <span className="truncate" title={`Ref: ${error.digest}`}>Ref: {error.digest}</span>
                  ) : null}
                </div>
              </div>
            </div>
          </Alert>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:w-auto"
            >
              {retrying ? (
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4A4 4 0 0 0 8 12H4Z"></path>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M21 12a9 9 0 1 1-3.07-6.78" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M21 3v6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
              <span>{retrying ? "Retrying…" : "Try again"}</span>
            </button>

            <Link
              href="/"
              prefetch={true}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-input bg-background px-4 py-3 text-sm font-semibold text-foreground shadow-sm transition hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:w-auto"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M3 10.5 12 3l9 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M9 21V12h6v9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>Go home</span>
            </Link>

            {!isOnline && (
              <Link
                href="/offline"
                prefetch={false}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-input bg-background px-4 py-3 text-sm font-semibold text-foreground shadow-sm transition hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:w-auto"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="m1 1 22 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M16.72 11.06A7.5 7.5 0 0 0 12 9.5c-2.32 0-4.38 1.06-5.72 2.72" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M5 12.55A10.94 10.94 0 0 0 1 21h22a10.94 10.94 0 0 0-4-8.44" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <span>Open offline page</span>
              </Link>
            )}
          </div>

          <Separator className="my-6" />

          <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-muted-foreground">Technical details</div>
              <CollapsibleTrigger asChild>
                <button
                  className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-xs font-medium text-foreground transition hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  aria-expanded={detailsOpen}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={detailsOpen ? "rotate-180 transition-transform" : "transition-transform"}>
                    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {detailsOpen ? "Hide" : "Show"}
                </button>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent forceMount>
              <div className="mt-4 overflow-hidden rounded-lg border bg-muted/50 p-3 text-xs">
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Name</span>
                    <code className="truncate font-mono">{error?.name ?? "Error"}</code>
                  </div>
                  {error?.digest ? (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Digest</span>
                      <code className="truncate font-mono">{error.digest}</code>
                    </div>
                  ) : null}
                </div>
                {error?.stack ? (
                  <pre className="mt-3 max-h-56 overflow-auto rounded-md bg-background p-3 text-[11px] leading-relaxed">{error.stack}</pre>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => navigator.clipboard?.writeText(`${error?.name ?? "Error"}: ${error?.message ?? ""}\n${error?.stack ?? ""}`)}
                    className="inline-flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-xs font-medium text-secondary-foreground transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2"/>
                      <rect x="2" y="2" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2"/>
                    </svg>
                    Copy details
                  </button>
                  <button
                    onClick={() => router.refresh()}
                    className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-xs font-medium text-foreground transition hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M21 12a9 9 0 1 1-3.07-6.78" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M21 3v6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Refresh data
                  </button>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </section>

      <p className="mx-auto mt-6 max-w-prose text-center text-xs text-muted-foreground">
        If this keeps happening, try clearing demo data in Settings or come back later.
      </p>
    </main>
  );
}
