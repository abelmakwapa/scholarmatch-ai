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
    "/profile/documents/policy:",
    "/profile/documents/readiness:",
    "/profile/documents/{document_id}:",
    "/profile/documents/{document_id}/download-url:",
    "/scholarships:",
    "/scholarships/{scholarship_id}/related:",
    "/scholarships/{scholarship_id}/saved:",
    "/scholarships/{scholarship_id}/reports:",
    "/matches:",
    "/matches/recalculation-jobs/{job_id}:",
    "/matches/{scholarship_id}/feedback:",
    "/applications:",
    "/applications/deadlines:",
    "/applications/{application_id}/checklist/{checklist_item_id}:",
    "/applications/{application_id}/reminder:",
    "/admin/ingestion-runs:",
  ]) {
    assert.ok(contract.includes(path), `missing ${path}`);
  }
});
