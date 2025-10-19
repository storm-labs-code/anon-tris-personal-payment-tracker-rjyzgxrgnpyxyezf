/**
 * CODE INSIGHT
 * This code's use case is to serve the PWA Web App Manifest for Tris, enabling installability and configuring app metadata across devices and browsers.
 * This code's full epic context is the PWA shell setup where the manifest is referenced by the root layout and cached by the service worker; shortcuts map to core app tabs for quick access.
 * This code's ui feel is clean, minimal, and calm with KRW-focused finance tracking; theme color follows #2563EB to match the primary brand color.
 */

export const dynamic = 'force-static'
export const revalidate = 3600

export async function GET() {
  const manifest = {
    id: '/',
    name: 'Tris',
    short_name: 'Tris',
    description:
      'Tris — 개인 결제 추적기. 간단하고 빠르게 지출을 기록하고, 영수증을 보관하며, 보고서를 확인하세요.',
    lang: 'ko',
    dir: 'ltr',
    categories: ['finance'],
    start_url: '/',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui', 'browser'],
    orientation: 'portrait',
    background_color: '#FFFFFF',
    theme_color: '#2563EB',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ],
    shortcuts: [
      { name: 'Transactions', short_name: '내역', url: '/transactions', description: '결제 내역 보기' },
      { name: 'Add Transaction', short_name: '추가', url: '/transactions/new', description: '새 결제 추가' },
      { name: 'Reports', short_name: '보고서', url: '/reports', description: '지출 보고서' },
      { name: 'Settings', short_name: '설정', url: '/settings', description: '환경설정' }
    ],
    prefer_related_applications: false
  }

  return new Response(JSON.stringify(manifest), {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400'
    }
  })
}
