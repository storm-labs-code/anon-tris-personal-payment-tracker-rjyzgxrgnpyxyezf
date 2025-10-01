import { FakeClient } from '@/utils/supabase/test-client'
import { createBrowserClient } from '@supabase/ssr'
import { SupabaseClient } from '@supabase/supabase-js'

const USE_FAKE_DATA = !process.env.NEXT_PUBLIC_SUPABASE_URL

export const supabaseBrowser = USE_FAKE_DATA
    ? (new FakeClient() as unknown as SupabaseClient)
    : createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
          {
              auth: {
                  persistSession: true,
                  autoRefreshToken: true,
              },
          }
      )
