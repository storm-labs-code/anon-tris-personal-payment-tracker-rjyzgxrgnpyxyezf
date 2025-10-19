/**
 * CODE INSIGHT
 * This code's use case is the Drilldown reports page that lists underlying transactions based on URL filter params.
 * This code's full epic context is Reports: filters are encoded in URL, data fetched from /api/reports/drilldown with pagination, and realtime updates invalidate queries.
 * This code's ui feel is mobile-first, clean, calm and confident with fast infinite scrolling and clear filter chips.
 */

import Client from './client';

export default async function DrilldownPage() {
  return <Client />;
}
