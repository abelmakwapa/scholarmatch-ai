"use client";

import { ApiClient } from "@/app/lib/api/client";
import { getSupabaseBrowserClient } from "@/app/lib/supabase/client";

/**
 * Builds an {@link ApiClient} whose bearer token is sourced live from the
 * current Supabase session, so a token refreshed mid-session is picked up on
 * the next request.
 */
export function createBrowserApiClient(): ApiClient {
  const supabase = getSupabaseBrowserClient();
  return new ApiClient(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  });
}
