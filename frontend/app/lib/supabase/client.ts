"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getPublicEnv } from "@/app/lib/env";

let browserClient: SupabaseClient | undefined;

/**
 * Returns a singleton Supabase client for use in the browser.
 *
 * The client persists the session in cookies (the `@supabase/ssr` default) so
 * that the Proxy and Route Handlers can read and refresh it server-side. Only
 * the public anon key is used here; the service-role key never reaches the
 * browser.
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (!browserClient) {
    const { supabaseUrl, supabaseAnonKey } = getPublicEnv();
    browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey);
  }
  return browserClient;
}
