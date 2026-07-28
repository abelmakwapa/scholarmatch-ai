import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "vitest";

test("the shared API contract is versioned and covers the baseline resources", async () => {
  const contract = await readFile(
    resolve(process.cwd(), "../docs/openapi.yaml"),
    "utf8",
  );

  assert.match(contract, /^openapi: 3\.1\.0/m);
  assert.match(contract, /url: http:\/\/localhost:8000\/api\/v1/);
  for (const path of [
    "/profile:",
    "/profile/documents:",
    "/scholarships:",
    "/matches:",
    "/applications:",
    "/admin/ingestion-runs:",
  ]) {
    assert.ok(contract.includes(path), `missing ${path}`);
  }
});
