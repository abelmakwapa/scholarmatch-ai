from app.schemas.scholarship import ScholarshipCreate
from app.schemas.user import ProfileCreate


def test_boundary_schemas_load_and_accept_contract_shapes() -> None:
    profile = ProfileCreate(
        full_name="Example Student",
        country="BW",
        study_level="undergraduate",
        interests=["engineering"],
    )
    scholarship = ScholarshipCreate(
        title="Example Scholarship",
        provider="Example Provider",
        status="published",
    )

    assert profile.country == "BW"
    assert scholarship.status == "published"
