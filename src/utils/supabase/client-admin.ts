import { FakeClient } from '@/utils/supabase/test-client'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

const USE_FAKE_DATA = !process.env.NEXT_PUBLIC_SUPABASE_URL

export const supabaseAdmin = USE_FAKE_DATA
    ? (new FakeClient() as unknown as SupabaseClient)
    : createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!)
