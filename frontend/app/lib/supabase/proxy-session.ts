import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getPublicEnv } from "@/app/lib/env";

/**
 * Refreshes the Supabase session for an incoming request and returns both the
 * mutated response (carrying any rotated auth cookies) and the resolved user.
 *
 * This runs inside the Proxy for an optimistic check only — the authoritative
 * check is the backend verifying the JWT and enforcing row-level security.
 */
export async function refreshSession(request: NextRequest): Promise<{
  response: NextResponse;
  user: User | null;
}> {
  let response = NextResponse.next({ request });

  const { supabaseUrl, supabaseAnonKey } = getPublicEnv();
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // `getUser()` revalidates the token with Supabase and triggers a refresh when
  // the access token has expired but the refresh token is still valid. If auth
  // is unreachable, degrade to "no user" rather than failing every request —
  // the backend remains the authoritative gate.
  let user: User | null = null;
  try {
    const result = await supabase.auth.getUser();
    user = result.data.user;
  } catch {
    user = null;
  }

  return { response, user };
}
