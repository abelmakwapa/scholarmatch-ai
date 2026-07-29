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
        "/scholarships",
        "/scholarships/{scholarship_id}",
        "/scholarships/{scholarship_id}/related",
        "/scholarships/{scholarship_id}/saved",
        "/scholarships/{scholarship_id}/reports",
        "/matches",
        "/matches/recalculate",
        "/applications",
        "/applications/{application_id}",
        "/admin/ingestion-runs",
        "/admin/ingestion-runs/{run_id}",
    } <= paths.keys()
