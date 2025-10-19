/**
 * CODE INSIGHT
 * This code's use case is the Reports > Categories page, rendering the main content area only.
 * This code's full epic context is to fetch category spend aggregates from /api/reports/categories based on URL filters, display a donut chart and sortable legend, and navigate to drilldown on interactions. It also subscribes to Supabase Realtime on transactions to auto-refresh.
 * This code's ui feel is calm, modern, and mobile-first with clean cards, subtle animations, and accessible interactions that feel reliable and simple.
 */

import CategoriesClient from './client'

export default async function Page() {
  return <CategoriesClient />
}
