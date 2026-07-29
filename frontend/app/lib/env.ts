/**
 * Public runtime configuration.
 *
 * Every value here is a `NEXT_PUBLIC_*` variable and is therefore embedded in
 * the browser bundle. Server-only secrets (for example the Supabase
 * service-role key) must never be read through this module.
 */

type PublicEnv = {
  siteUrl: string;
  apiBaseUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
};

function read(name: string, value: string | undefined): string {
  if (!value || value.length === 0) {
    throw new Error(
      `Missing required public environment variable ${name}. ` +
        `Copy .env.example to .env.local and fill it in.`,
    );
  }
  return value;
}

/**
 * Reads the public configuration lazily so that a missing variable surfaces as
 * a clear runtime error at the point of use rather than crashing the module
 * graph during a production build.
 */
export function getPublicEnv(): PublicEnv {
  return {
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
    apiBaseUrl: read(
      "NEXT_PUBLIC_API_BASE_URL",
      process.env.NEXT_PUBLIC_API_BASE_URL,
    ),
    supabaseUrl: read(
      "NEXT_PUBLIC_SUPABASE_URL",
      process.env.NEXT_PUBLIC_SUPABASE_URL,
    ),
    supabaseAnonKey: read(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ),
  };
}
