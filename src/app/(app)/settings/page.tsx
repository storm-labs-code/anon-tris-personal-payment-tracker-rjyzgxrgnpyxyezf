/**
 * CODE INSIGHT
 * This code's use case is the Settings page content for Tris, providing user preferences for theme, accessibility, demo flags, and PWA install.
 * This code's full epic context is the PWA shell where settings persist via localStorage and a compact 'tris_prefs' cookie for SSR theming.
 * This code's ui feel is calm, minimal, mobile-first cards with accessible controls, smooth transitions, and immediate feedback.
 */

import Client from './client'
import { cookies } from 'next/headers'

export type Prefs = {
  theme: 'light' | 'dark' | 'system'
  highContrast: boolean
  reduceMotion: boolean
  textScale: 'normal' | 'large'
  haptics: boolean
  language: 'en' | 'ko'
  skeletonsDemo: boolean
  animationsDemo: boolean
}

function defaults(): Prefs {
  return {
    theme: 'system',
    highContrast: false,
    reduceMotion: false,
    textScale: 'normal',
    haptics: false,
    language: 'en',
    skeletonsDemo: false,
    animationsDemo: true,
  }
}

function parsePrefsCookie(raw: string | undefined): Prefs {
  const d = defaults()
  if (!raw) return d
  try {
    const obj = JSON.parse(raw)
    // Support compact schema { t, c, m, x, h, g, s, a }
    if (obj && (obj.t || obj.theme)) {
      const theme = obj.t === 'l' ? 'light' : obj.t === 'd' ? 'dark' : obj.t === 's' ? 'system' : obj.theme ?? d.theme
      const highContrast = typeof obj.c !== 'undefined' ? Boolean(Number(obj.c)) : obj.highContrast ?? d.highContrast
      const reduceMotion = typeof obj.m !== 'undefined' ? Boolean(Number(obj.m)) : obj.reduceMotion ?? d.reduceMotion
      const textScale = obj.x === 'l' ? 'large' : obj.x === 'n' ? 'normal' : obj.textScale ?? d.textScale
      const haptics = typeof obj.h !== 'undefined' ? Boolean(Number(obj.h)) : obj.haptics ?? d.haptics
      const language = obj.g === 'ko' || obj.g === 'en' ? obj.g : obj.language ?? d.language
      const skeletonsDemo = typeof obj.s !== 'undefined' ? Boolean(Number(obj.s)) : obj.skeletonsDemo ?? d.skeletonsDemo
      const animationsDemo = typeof obj.a !== 'undefined' ? Boolean(Number(obj.a)) : obj.animationsDemo ?? d.animationsDemo
      return {
        theme,
        highContrast,
        reduceMotion,
        textScale,
        haptics,
        language,
        skeletonsDemo,
        animationsDemo,
      }
    }
    // Fallback to verbose schema directly
    return {
      ...d,
      ...obj,
    }
  } catch {
    return d
  }
}

export default function SettingsPage() {
  const cookieStore = cookies()
  const raw = cookieStore.get('tris_prefs')?.value
  const initialPrefs = parsePrefsCookie(raw)

  return (
    <section className="mx-auto w-full max-w-3xl space-y-6 py-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Personalize Tris to match your preferences. Changes save instantly.</p>
      </div>
      <Client initialPrefs={initialPrefs} />
    </section>
  )
}
