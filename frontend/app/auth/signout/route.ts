import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/app/lib/supabase/server";

/**
 * Signs the user out and clears the session cookies. Implemented as a POST
 * Route Handler so sign-out is a deliberate, CSRF-resistant action rather than
 * something triggered by a link prefetch.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/sign-in", request.nextUrl.origin), {
    status: 303,
  });
}
