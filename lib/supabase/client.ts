import { createClient } from '@supabase/supabase-js';

// Session is kept in localStorage and refreshed automatically whenever there is
// internet, which gives the "logged in forever" behaviour. Offline, the cached
// session is simply used as-is.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  },
);
