/**
 * CODE INSIGHT
 * This code's use case is to render the Reports > Trends page shell as a server component and delegate
 * all data fetching, URL param handling, and interactive UI to a client component. It keeps the page
 * SSR-safe while the client handles SWR, realtime updates, and charts.
 * This code's full epic context is the Reports module where filters are encoded in URL params and each
 * reports page fetches via dedicated API routes. The Trends page focuses on rolling 30/90-day windows.
 * This code's ui feel is clean and minimal, leveraging a card layout and mobile-first spacing. The client
 * component renders a responsive line chart with smooth interactions and drilldown navigation.
 */

import Client from './client'

export default function Page() {
  return (
    <div className="w-full">
      <Client />
    </div>
  )
}
