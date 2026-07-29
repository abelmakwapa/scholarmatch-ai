import type { SupabaseClient } from "@supabase/supabase-js";

import {
  ONBOARDING_VERSION,
  type OnboardingDraft,
  type OnboardingProgress,
} from "@/app/lib/onboarding/types";

const LOCAL_KEY = "scholarmatch.onboarding.v1";
const METADATA_KEY = "onboarding";

/** Persistence for onboarding progress. Implementations must not throw on read. */
export interface OnboardingStore {
  load(): Promise<OnboardingProgress | null>;
  /** Persists progress. Resolves `{ remote }` telling whether the durable
   * (cross-device) write succeeded; a local-only success still resolves. */
  save(progress: OnboardingProgress): Promise<{ remote: boolean }>;
  clear(): Promise<void>;
}

export function makeProgress(
  draft: OnboardingDraft,
  lastCompletedStep: string | null,
): OnboardingProgress {
  return {
    draft,
    lastCompletedStep,
    updatedAt: new Date().toISOString(),
    version: ONBOARDING_VERSION,
  };
}

function isProgress(value: unknown): value is OnboardingProgress {
  return (
    typeof value === "object" &&
    value !== null &&
    "draft" in value &&
    "version" in value &&
    (value as { version?: unknown }).version === ONBOARDING_VERSION
  );
}

// --- Local (this-device) mirror -------------------------------------------

function readLocal(): OnboardingProgress | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isProgress(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeLocal(progress: OnboardingProgress): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(progress));
  } catch {
    // Storage may be full or blocked (private mode); remote save still applies.
  }
}

function clearLocal(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LOCAL_KEY);
  } catch {
    // ignore
  }
}

// --- Combined store: local mirror + Supabase user metadata -----------------

/**
 * Combines an instant local mirror with a durable copy in the user's Supabase
 * metadata. The metadata copy is what lets a student resume on another device;
 * the local copy makes resume instant and survives brief offline periods.
 */
export function createOnboardingStore(
  supabase: SupabaseClient,
): OnboardingStore {
  return {
    async load() {
      const local = readLocal();

      let remote: OnboardingProgress | null = null;
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const candidate = user?.user_metadata?.[METADATA_KEY];
        if (isProgress(candidate)) {
          remote = candidate;
        }
      } catch {
        remote = null; // offline or signed out — fall back to local
      }

      if (remote && local) {
        // Prefer whichever was written most recently so an offline edit on this
        // device is not clobbered by a stale server copy, and vice versa.
        return remote.updatedAt >= local.updatedAt ? remote : local;
      }
      return remote ?? local;
    },

    async save(progress) {
      // Write the local mirror first so progress is never lost, even offline.
      writeLocal(progress);
      try {
        const { error } = await supabase.auth.updateUser({
          data: { [METADATA_KEY]: progress },
        });
        return { remote: !error };
      } catch {
        return { remote: false };
      }
    },

    async clear() {
      clearLocal();
      try {
        await supabase.auth.updateUser({ data: { [METADATA_KEY]: null } });
      } catch {
        // Best effort; the profile now exists server-side regardless.
      }
    },
  };
}
