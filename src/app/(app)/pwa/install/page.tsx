/**
 * CODE INSIGHT
 * This code's use case is to render the PWA Install guide page where users learn how to install the app across platforms.
 * This code's full epic context is the App Shell PWA flow where beforeinstallprompt is captured and can be triggered from this page.
 * This code's ui feel is clean, calm, and mobile-first with concise cards, clear instructions, and a simple test widget for install support.
 */

import Link from "next/link";
import InstallWidget from "./client";

export default async function Page() {
  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-6 md:py-10">
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Install Tris</h1>
        <p className="mt-2 text-sm text-muted-foreground md:text-base">
          Add Tris to your Home Screen for a fast, app-like experience with offline support.
        </p>
      </div>

      <div className="grid gap-6">
        <div className="rounded-2xl border bg-card p-4 shadow-sm md:p-6">
          <InstallWidget />
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-sm md:p-6">
          <h2 className="text-lg font-medium md:text-xl">Platform-specific instructions</h2>
          <p className="mt-1 text-sm text-muted-foreground">Follow the steps below if the Install button isn’t available.</p>

          <div className="mt-4 grid gap-4">
            {/* Android Chrome */}
            <div className="rounded-xl border bg-background p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">Android · Chrome</h3>
                <span className="text-xs text-muted-foreground">Add to Home screen</span>
              </div>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed">
                <li>Tap the Install button below if visible. Otherwise, tap the three-dot menu (⋮).</li>
                <li>Choose “Install app” or “Add to Home screen”.</li>
                <li>Confirm to add Tris to your Home screen.</li>
              </ol>
            </div>

            {/* iOS Safari */}
            <div className="rounded-xl border bg-background p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">iOS · Safari</h3>
                <span className="text-xs text-muted-foreground">Add to Home Screen</span>
              </div>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed">
                <li>Tap the Share button in Safari.</li>
                <li>Scroll and tap “Add to Home Screen”.</li>
                <li>Tap “Add” to finish installation.</li>
              </ol>
            </div>

            {/* Desktop Chrome/Edge */}
            <div className="rounded-xl border bg-background p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">Desktop · Chrome / Edge</h3>
                <span className="text-xs text-muted-foreground">Install app</span>
              </div>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed">
                <li>Click the Install icon in the address bar, or open the browser menu.</li>
                <li>Choose “Install Tris”.</li>
                <li>Confirm the prompt to complete installation.</li>
              </ol>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-sm md:p-6">
          <h2 className="text-lg font-medium md:text-xl">What’s next?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            After installing, open Tris from your Home Screen or app launcher. You can manage appearance and accessibility in Settings.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-full bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Go to Home
            </Link>
            <Link
              href="/transactions"
              className="inline-flex items-center justify-center rounded-full bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              View Transactions
            </Link>
            <Link
              href="/settings"
              className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-transform hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Open Settings
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
