/**
 * CODE INSIGHT
 * This code's use case is the Root Layout for Tris — it defines global HTML structure, SSR-driven theming/accessibility data attributes via cookie, PWA meta, and global helpers.
 * This code's full epic context is to provide a stable, mobile-first PWA shell with SSR-matched theme and motion/contrast preferences, enabling fast initial paint and consistent UX across all routes.
 * This code's ui feel is clean, calm, and modern, with accessible defaults, a skip link, and a global live region for toasts. No header/footer here; nested (app) layouts handle navigation and structure. 
 */

import "./globals.css";
import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { SidebarProvider } from "@/components/ui/sidebar";
import React from "react";

export const metadata: Metadata = {
  metadataBase: new URL("https://tris.app"),
  title: {
    default: "Tris — Personal Payment Tracker",
    template: "%s • Tris",
  },
  description:
    "Tris is a mobile-first PWA for personal payment tracking in KRW with quick entry, offline support, and clean reports.",
  applicationName: "Tris",
  manifest: "/manifest.webmanifest",
  colorScheme: "light dark",
  formatDetection: { telephone: false, date: false, address: false, email: false, url: false },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Tris",
  },
  icons: {
    icon: [{ url: "/favicon.ico" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
    shortcut: ["/favicon.ico"],
  },
  other: {
    "mobile-web-app-capable": "yes",
    "theme-color": "#2563EB",
    "msapplication-TileColor": "#2563EB",
    "color-scheme": "light dark",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#2563EB" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

type TrisPrefsCookie = {
  theme?: "light" | "dark" | "system";
  contrast?: "normal" | "high";
  motion?: "full" | "reduce";
  textScale?: "normal" | "large" | "xl";
};

function readPrefsFromCookie(): TrisPrefsCookie {
  const raw = cookies().get("tris_prefs")?.value;
  if (!raw) return { theme: "system", contrast: "normal", motion: "full" };
  try {
    const parsed = JSON.parse(raw) as TrisPrefsCookie;
    return {
      theme: parsed.theme ?? "system",
      contrast: parsed.contrast ?? "normal",
      motion: parsed.motion ?? "full",
      textScale: parsed.textScale ?? "normal",
    };
  } catch {
    return { theme: "system", contrast: "normal", motion: "full" };
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const prefs = readPrefsFromCookie();
  const theme = prefs.theme === "dark" ? "dark" : prefs.theme === "light" ? "light" : "system";
  const dataTheme = theme;
  const dataContrast = prefs.contrast === "high" ? "high" : "normal";
  const dataMotion = prefs.motion === "reduce" ? "reduce" : "full";

  const bodyContrastClass = dataContrast === "high" ? "contrast-more" : "";
  const bodyMotionClass = dataMotion === "reduce" ? "motion-reduce" : "motion-safe";

  return (
    <html
      lang="ko"
      data-theme={dataTheme}
      data-contrast={dataContrast}
      data-motion={dataMotion}
      className={theme === "dark" ? "dark" : undefined}
      suppressHydrationWarning
    >
      <body className={`min-h-svh bg-background text-foreground antialiased ${bodyContrastClass} ${bodyMotionClass}`}>
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground shadow-md"
        >
          본문으로 건너뛰기
        </a>

        <SidebarProvider>
          <main id="content" className="min-h-svh">
            {children}
          </main>
        </SidebarProvider>

        <div id="sr-live" role="status" aria-live="polite" aria-atomic="true" className="sr-only" />
      </body>
    </html>
  );
}
