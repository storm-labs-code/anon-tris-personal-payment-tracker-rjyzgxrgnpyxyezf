import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RestoreSuccessClient } from "./client";

/**
 * CODE INSIGHT
 * This code's use case is to render the Restore Success page after a backup import.
 * This code's full epic context is the Backup & Export flow where a user restores a backup and is redirected here with URL params summarizing the import.
 * This code's ui feel is calm, modern, and celebratory with concise summaries and clear next steps.
 */

export default function Page({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const getParam = (key: string) => {
    const v = searchParams?.[key];
    return Array.isArray(v) ? v[0] : v ?? "";
  };

  const toCount = (val: string) => {
    const n = parseInt(val, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };

  const mode = (getParam("mode") || "merge").toLowerCase();

  const counts = {
    transactions: toCount(getParam("transactions")),
    receipts: toCount(getParam("receipts")),
    categories: toCount(getParam("categories")),
    tags: toCount(getParam("tags")),
    presets: toCount(getParam("presets")),
    budgets: toCount(getParam("budgets")),
    recurring: toCount(getParam("recurring")),
  } as const;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 md:py-10">
      <section className="rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
        <div className="p-6 md:p-8">
          <RestoreSuccessClient mode={mode} counts={counts} />

          <Separator className="my-6" />

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Link
              href="/settings"
              className="inline-flex items-center justify-center rounded-lg border border-input bg-secondary px-4 py-2.5 text-sm font-medium text-secondary-foreground shadow-sm transition-colors hover:bg-secondary/80 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              Go to Settings
            </Link>
            <Link
              href="/settings/backup"
              className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-transform hover:scale-[1.01] hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              Back to Backup & Export
            </Link>
          </div>
        </div>
      </section>

      <div className="mt-6">
        <Alert className="border-0 bg-muted">
          <AlertTitle className="font-semibold">Heads up</AlertTitle>
          <AlertDescription>
            Restored data may take a moment to sync across devices. If something looks off, refresh the page or revisit Backup & Export to verify.
          </AlertDescription>
        </Alert>
      </div>
    </main>
  );
}
