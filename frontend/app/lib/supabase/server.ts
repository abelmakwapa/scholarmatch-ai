import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { getPublicEnv } from "@/app/lib/env";

/**
 * Creates a request-scoped Supabase client for Server Components and Route
 * Handlers. Session cookies are read from and written back through the async
 * `cookies()` store so that token refresh is transparent to the caller.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  const { supabaseUrl, supabaseAnonKey } = getPublicEnv();
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // `setAll` was called from a Server Component where cookies are
          // read-only. The Proxy refreshes the session cookie instead, so this
          // is safe to ignore.
        }
      },
    },
  });
}
