import { beforeEach, describe, expect, test, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createOnboardingStore,
  makeProgress,
} from "@/app/lib/onboarding/store";

type FakeAuth = {
  getUser: ReturnType<typeof vi.fn>;
  updateUser: ReturnType<typeof vi.fn>;
};

function fakeSupabase(auth: Partial<FakeAuth>): SupabaseClient {
  return {
    auth: {
      getUser:
        auth.getUser ?? vi.fn().mockResolvedValue({ data: { user: null } }),
      updateUser: auth.updateUser ?? vi.fn().mockResolvedValue({ error: null }),
    },
  } as unknown as SupabaseClient;
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("createOnboardingStore", () => {
  test("save writes the local mirror and the durable metadata copy", async () => {
    const updateUser = vi.fn().mockResolvedValue({ error: null });
    const store = createOnboardingStore(fakeSupabase({ updateUser }));

    const result = await store.save(
      makeProgress({ fullName: "Ada" }, "identity"),
    );

    expect(result).toEqual({ remote: true });
    expect(updateUser).toHaveBeenCalledOnce();
    expect(window.localStorage.getItem("scholarmatch.onboarding.v1")).toContain(
      "Ada",
    );
  });

  test("save survives an offline metadata write, keeping local progress", async () => {
    const updateUser = vi.fn().mockRejectedValue(new Error("offline"));
    const store = createOnboardingStore(fakeSupabase({ updateUser }));

    const result = await store.save(
      makeProgress({ fullName: "Grace" }, "identity"),
    );

    expect(result).toEqual({ remote: false });
    expect(window.localStorage.getItem("scholarmatch.onboarding.v1")).toContain(
      "Grace",
    );
  });

  test("load prefers the most recently updated copy across devices", async () => {
    // Older copy sits in local storage; a newer copy lives in metadata.
    const older = makeProgress({ fullName: "Local" }, "identity");
    older.updatedAt = "2026-01-01T00:00:00.000Z";
    window.localStorage.setItem(
      "scholarmatch.onboarding.v1",
      JSON.stringify(older),
    );

    const newer = makeProgress({ fullName: "Remote" }, "location");
    newer.updatedAt = "2026-06-01T00:00:00.000Z";
    const getUser = vi.fn().mockResolvedValue({
      data: { user: { user_metadata: { onboarding: newer } } },
    });

    const store = createOnboardingStore(fakeSupabase({ getUser }));
    const loaded = await store.load();

    expect(loaded?.draft.fullName).toBe("Remote");
  });

  test("load falls back to local when the network is unavailable", async () => {
    const local = makeProgress({ fullName: "Local" }, "identity");
    window.localStorage.setItem(
      "scholarmatch.onboarding.v1",
      JSON.stringify(local),
    );
    const getUser = vi.fn().mockRejectedValue(new Error("offline"));

    const store = createOnboardingStore(fakeSupabase({ getUser }));
    const loaded = await store.load();

    expect(loaded?.draft.fullName).toBe("Local");
  });

  test("clear removes local and null-writes the metadata copy", async () => {
    window.localStorage.setItem("scholarmatch.onboarding.v1", "{}");
    const updateUser = vi.fn().mockResolvedValue({ error: null });
    const store = createOnboardingStore(fakeSupabase({ updateUser }));

    await store.clear();

    expect(
      window.localStorage.getItem("scholarmatch.onboarding.v1"),
    ).toBeNull();
    expect(updateUser).toHaveBeenCalledWith({ data: { onboarding: null } });
  });
});
