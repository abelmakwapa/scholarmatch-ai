import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { sanitizeRedirectPath } from "@/app/lib/routing/safe-redirect";
import { createSupabaseServerClient } from "@/app/lib/supabase/server";

/**
 * Completes email-based auth links (signup verification, password recovery,
 * email change) by exchanging the link's credential for a session cookie, then
 * redirects to a sanitized `next` path.
 *
 * Both link shapes are handled: PKCE links carry `?code=`, while the older
 * confirmation links carry `?token_hash=&type=`.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = request.nextUrl;
  const next = sanitizeRedirectPath(searchParams.get("next"));

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createSupabaseServerClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  // Invalid or expired link — send the user somewhere they can recover.
  return NextResponse.redirect(new URL("/sign-in?reason=link-invalid", origin));
}
