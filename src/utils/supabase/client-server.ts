import { FakeClient } from '@/utils/supabase/test-client'
import { createServerClient } from '@supabase/ssr'
import { SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const USE_FAKE_DATA = !process.env.NEXT_PUBLIC_SUPABASE_URL

export const supabaseServer = USE_FAKE_DATA
    ? (new FakeClient() as unknown as SupabaseClient)
    : await (async () => {
          const cookieStore = await cookies()

          return createServerClient(
              process.env.NEXT_PUBLIC_SUPABASE_URL!,
              process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
              {
                  cookies: {
                      getAll() {
                          const all = cookieStore.getAll()
                          return all.map(({ name, value }) => ({ name, value }))
                      },
                  },
              }
          )
      })()
