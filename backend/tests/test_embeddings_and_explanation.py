"""Tests for semantic embeddings and Qwen explanation adapter."""

import asyncio
import hashlib
import json
from datetime import date
from typing import Any
from uuid import uuid4

import pytest
from pydantic import BaseModel

from app.core.errors import ApiError
from app.schemas.match import (
    EligibilityResult,
    RuleOutcome,
    ScoreComponent,
)
from app.services.embeddings import (
    EmbeddingModelConfig,
    EmbeddingProvider,
    EmbeddingService,
    build_profile_canonical_input,
    build_scholarship_canonical_input,
    compute_content_hash,
)
from app.services.qwen_explanation import (
    QwenExplanationProvider,
    QwenExplanationSchema,
)


class MockEmbeddingProvider(EmbeddingProvider):
    """Mock provider for testing."""

    def __init__(
        self,
        dimensions: int = 1536,
        raise_error: bool = False,
        delay_seconds: float = 0,
    ) -> None:
        self._dimensions = dimensions
        self._raise_error = raise_error
        self._delay_seconds = delay_seconds
        self.call_count = 0

    async def generate_embedding(self, text: str, model_name: str) -> list[float]:
        self.call_count += 1
        if self._delay_seconds > 0:
            await asyncio.sleep(self._delay_seconds)
        if self._raise_error:
            raise ApiError(
                status_code=503,
                code="EMBEDDING_GENERATION_FAILED",
                message="Mock embedding failure.",
            )
        text_hash = hashlib.sha256(text.encode()).hexdigest()
        # Generate deterministic mock embedding values
        return [float(i % 100) / 100 for i in range(self._dimensions)]


class TestEmbeddingCanonicalInputs:
    """Test canonical input generation for embeddings."""

    def test_profile_canonical_input_minimal(self) -> None:
        profile = {"study_level": "undergraduate", "country": "BW"}
        result = build_profile_canonical_input(profile)
        assert "Study level: undergraduate" in result
        assert "Country: BW" in result

    def test_profile_canonical_input_excludes_sensitive(self) -> None:
        profile = {
            "study_level": "undergraduate",
            "full_name": "John Doe",
            "interests": ["AI", "health"],
            "goals": "Improve healthcare with AI",
        }
        result = build_profile_canonical_input(profile)
        assert "John Doe" not in result
        assert "Interests:" in result
        assert "Goals:" in result

    def test_profile_canonical_input_truncates_long_text(self) -> None:
        profile = {"goals": "A" * 10000}
        result = build_profile_canonical_input(profile)
        assert len(result) <= 8000

    def test_scholarship_canonical_input(self) -> None:
        scholarship = {
            "title": "Computer Science Scholarship",
            "funding_type": "full",
            "study_levels": ["undergraduate", "postgraduate"],
            "fields_of_study": ["Computer Science", "Engineering"],
        }
        result = build_scholarship_canonical_input(scholarship)
        assert "Title: Computer Science Scholarship" in result
        assert "Funding type: full" in result

    def test_content_hash_deterministic(self) -> None:
        content1 = "test content"
        content2 = "test content"
        content3 = "different content"
        assert compute_content_hash(content1) == compute_content_hash(content2)
        assert compute_content_hash(content1) != compute_content_hash(content3)


class TestEmbeddingService:
    """Test embedding service with caching and versioning."""

    @pytest.mark.asyncio
    async def test_generates_profile_embedding(self) -> None:
        provider = MockEmbeddingProvider(dimensions=8)
        model = EmbeddingModelConfig(name="test-model", provider="qwen", dimensions=8)
        service = EmbeddingService(provider, model, embedding_version=1)

        profile_id = uuid4()
        profile_data = {
            "data_version": 3,
            "study_level": "undergraduate",
            "field_of_study": "Computer Science",
            "country": "BW",
            "interests": ["AI"],
            "goals": "Healthcare AI",
        }

        result = await service.generate_profile_embedding(profile_id, profile_data)

        assert result.entity_id == profile_id
        assert result.entity_type == "profile"
        assert result.model_name == "test-model"
        assert result.dimensions == 8
        assert len(result.embedding) == 8
        assert not result.skipped

    @pytest.mark.asyncio
    async def test_skips_unchanged_content(self) -> None:
        provider = MockEmbeddingProvider(dimensions=8)
        model = EmbeddingModelConfig(name="test-model", provider="qwen", dimensions=8)
        service = EmbeddingService(provider, model, embedding_version=1)

        profile_id = uuid4()
        profile_data = {"data_version": 3, "study_level": "undergraduate"}

        result1 = await service.generate_profile_embedding(profile_id, profile_data, existing_hash=None)
        assert not result1.skipped

        result2 = await service.generate_profile_embedding(
            profile_id, profile_data, existing_hash=result1.content_hash
        )
        assert result2.skipped
        assert result2.skip_reason == "content_unchanged"
        assert provider.call_count == 1

    @pytest.mark.asyncio
    async def test_handles_provider_failure(self) -> None:
        provider = MockEmbeddingProvider(dimensions=8, raise_error=True)
        model = EmbeddingModelConfig(name="test-model", provider="qwen", dimensions=8)
        service = EmbeddingService(provider, model)

        profile_id = uuid4()
        profile_data = {"data_version": 1, "study_level": "undergraduate"}

        with pytest.raises(ApiError, match="EMBEDDING_GENERATION_FAILED"):
            await service.generate_profile_embedding(profile_id, profile_data)


class TestQwenExplanationSchema:
    """Test Qwen explanation schema validation."""

    def test_valid_explanation(self) -> None:
        data = {
            "summary": {"outcome": "eligible", "one_line_summary": "Strong academic fit."},
            "supporting_reasons": [
                {"category": "academic_fit", "description": "GPA meets requirements.", "severity": "moderate"}
            ],
            "blockers": [],
            "missing_information": [],
            "next_actions": ["Submit application before deadline."],
        }
        schema = QwenExplanationSchema.model_validate(data)
        assert schema.summary.outcome == "eligible"

    def test_rejects_probability_claims(self) -> None:
        data = {
            "summary": {"outcome": "eligible", "one_line_summary": "Good chance."},
            "supporting_reasons": [
                {"category": "academic_fit", "description": "High probability of receiving award."}
            ],
            "blockers": [],
            "missing_information": [],
            "next_actions": [],
        }
        with pytest.raises(ValueError, match="probability"):
            QwenExplanationSchema.model_validate(data)

    def test_empty_reasons_allowed(self) -> None:
        data = {
            "summary": {"outcome": "ineligible", "one_line_summary": "Does not meet requirements."},
            "supporting_reasons": [],
            "blockers": [],
            "missing_information": ["gpa"],
            "next_actions": ["Complete profile."],
        }
        schema = QwenExplanationSchema.model_validate(data)
        assert len(schema.supporting_reasons) == 0


class TestQwenExplanationProvider:
    """Test Qwen explanation provider."""

    def _create_eligibility(self) -> EligibilityResult:
        return EligibilityResult(
            outcome=RuleOutcome.ELIGIBLE,
            hard_rule_results=[],
            soft_rule_results=[],
            reasons=[],
            missing_profile_fields=[],
        )

    def _create_score_components(self) -> list[ScoreComponent]:
        return [
            ScoreComponent(
                name="academic_fit",
                formula_version="v1",
                score=0.85,
                weight=0.30,
                weighted_score=0.255,
                evidence=["gpa", "study_level"],
            )
        ]

    def test_build_prompt_includes_facts(self) -> None:
        provider = QwenExplanationProvider(api_key="test", api_url="http://test")
        scholarship = {"title": "Test Scholarship", "funding_type": "full"}
        eligibility = self._create_eligibility()
        components = self._create_score_components()
        profile = {"study_level": "undergraduate", "country": "BW"}

        prompt = provider._build_prompt(scholarship, eligibility, components, profile)

        assert "Test Scholarship" in prompt
        assert "academic_fit" in prompt

    def test_input_hash_deterministic(self) -> None:
        provider = QwenExplanationProvider(api_key="test", api_url="http://test")
        scholarship = {"title": "Test"}
        eligibility = self._create_eligibility()
        components = self._create_score_components()
        profile = {"country": "BW"}

        hash1 = provider._compute_input_hash(scholarship, eligibility, components, profile)
        hash2 = provider._compute_input_hash(scholarship, eligibility, components, profile)
        assert hash1 == hash2

    def test_input_hash_changes_with_content(self) -> None:
        provider = QwenExplanationProvider(api_key="test", api_url="http://test")
        scholarship1 = {"title": "Test A"}
        scholarship2 = {"title": "Test B"}
        eligibility = self._create_eligibility()
        components = self._create_score_components()
        profile = {}

        hash1 = provider._compute_input_hash(scholarship1, eligibility, components, profile)
        hash2 = provider._compute_input_hash(scholarship2, eligibility, components, profile)
        assert hash1 != hash2


class GoldenEvaluationCase(BaseModel):
    """A golden evaluation case for manual review."""

    name: str
    profile: dict[str, Any]
    scholarship: dict[str, Any]
    expected_eligibility: str
    expected_retrieval_relevant: bool
    expected_explanation_useful: bool
    notes: str = ""


GOLDEN_EVALUATION_SET = [
    GoldenEvaluationCase(
        name="CS_student_full_ride",
        profile={"study_level": "undergraduate", "field_of_study": "Computer Science", "country": "BW"},
        scholarship={"title": "CS Excellence Award", "study_levels": ["undergraduate"]},
        expected_eligibility="eligible",
        expected_retrieval_relevant=True,
        expected_explanation_useful=True,
        notes="Clear match on study level and field.",
    ),
    GoldenEvaluationCase(
        name="wrong_study_level",
        profile={"study_level": "doctoral", "field_of_study": "Biology"},
        scholarship={"title": "Undergraduate Merit Scholarship", "study_levels": ["undergraduate"]},
        expected_eligibility="ineligible",
        expected_retrieval_relevant=False,
        expected_explanation_useful=True,
        notes="Should be filtered out by hard rules.",
    ),
]


class TestGoldenEvaluationSet:
    """Test golden evaluation cases for human review."""

    @pytest.mark.parametrize("case", GOLDEN_EVALUATION_SET, ids=lambda c: c.name)
    def test_case_structure(self, case: GoldenEvaluationCase) -> None:
        assert case.name
        assert case.profile
        assert case.scholarship
        assert case.expected_eligibility in ("eligible", "ineligible", "unknown")
        assert isinstance(case.expected_retrieval_relevant, bool)
        assert isinstance(case.expected_explanation_useful, bool)
