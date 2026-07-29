import "server-only";

import { ApiClient } from "@/app/lib/api/client";

/** Creates a request-local API client; every underlying fetch uses no-store. */
export function createServerApiClient(accessToken: string): ApiClient {
  return new ApiClient(async () => accessToken);
}
