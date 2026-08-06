from pathlib import Path

import yaml
from openapi_spec_validator import validate

CONTRACT_PATH = Path(__file__).resolve().parents[2] / "docs" / "openapi.yaml"


def test_openapi_contract_is_valid_and_versioned() -> None:
    contract = yaml.safe_load(CONTRACT_PATH.read_text(encoding="utf-8"))

    validate(contract)
    assert contract["openapi"] == "3.1.0"
    assert contract["servers"][0]["url"].endswith("/api/v1")


def test_required_resource_paths_are_declared() -> None:
    contract = yaml.safe_load(CONTRACT_PATH.read_text(encoding="utf-8"))
    paths = contract["paths"]

    assert {
        "/profile",
        "/profile/documents",
        "/profile/documents/policy",
        "/profile/documents/readiness",
        "/profile/documents/{document_id}",
        "/profile/documents/{document_id}/download-url",
        "/scholarships",
        "/scholarships/{scholarship_id}",
        "/scholarships/{scholarship_id}/related",
        "/scholarships/{scholarship_id}/saved",
        "/scholarships/{scholarship_id}/reports",
        "/matches",
        "/matches/recalculate",
        "/matches/{scholarship_id}",
        "/matches/recalculation-jobs/{job_id}",
        "/matches/{scholarship_id}/feedback",
        "/applications",
        "/applications/deadlines",
        "/applications/{application_id}",
        "/applications/{application_id}/checklist/{checklist_item_id}",
        "/applications/{application_id}/reminder",
        "/admin/ingestion-runs",
        "/admin/ingestion-runs/{run_id}",
        "/admin/ingestion-runs/{run_id}/retry",
        "/admin/scholarships",
        "/admin/scholarships/{scholarship_id}",
        "/admin/scholarships/{scholarship_id}/lifecycle",
        "/admin/scholarships/{scholarship_id}/requirements",
        "/admin/scholarships/bulk-preview",
        "/admin/scholarships/bulk-action",
        "/admin/scholarships/bulk-actions/{operation_id}/undo",
        "/admin/duplicates",
        "/admin/duplicates/{duplicate_id}/merge",
        "/admin/verification-queue",
        "/admin/verification-queue/{scholarship_id}/verify",
        "/admin/audit-events",
    } <= paths.keys()


def test_every_admin_operation_declares_role_failure_responses() -> None:
    contract = yaml.safe_load(CONTRACT_PATH.read_text(encoding="utf-8"))
    for path, path_item in contract["paths"].items():
        if not path.startswith("/admin/"):
            continue
        for method in {"get", "post", "put", "patch", "delete"} & path_item.keys():
            responses = path_item[method]["responses"]
            assert "401" in responses, f"{method.upper()} {path} must declare 401"
            assert "403" in responses, f"{method.upper()} {path} must declare 403"


def test_admin_bulk_and_source_guardrails_are_bounded_in_contract() -> None:
    contract = yaml.safe_load(CONTRACT_PATH.read_text(encoding="utf-8"))
    schemas = contract["components"]["schemas"]

    assert (
        schemas["AdminBulkActionPreviewRequest"]["properties"]["scholarship_ids"]["maxItems"] == 50
    )
    assert schemas["AdminScholarshipWrite"]["properties"]["source_url"]["pattern"] == "^https://"
    assert schemas["AdminAuditEvent"]["additionalProperties"] is False
