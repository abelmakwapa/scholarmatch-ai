"""Semantic embedding generation and retrieval service.

This module provides privacy-minimized embedding generation for profiles and scholarships,
with support for async processing, content-hash-based deduplication, and safe re-indexing.
"""

import hashlib
import json
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field, ValidationError

from app.core.errors import ApiError


class EmbeddingModelConfig(BaseModel):
    """Configuration for an approved embedding model."""

    name: str = Field(min_length=1, max_length=100)
    provider: Literal["qwen", "openai", "azure"]
    dimensions: int = Field(ge=1, le=4096)
    status: Literal["active", "inactive", "deprecated"] = "active"


@dataclass(frozen=True, slots=True)
class EmbeddingResult:
    """Result of embedding generation."""

    entity_id: UUID
    entity_type: Literal["profile", "scholarship"]
    model_name: str
    dimensions: int
    content_hash: str
    entity_data_version: int
    embedding_version: int
    embedding: list[float]
    canonical_input: str
    skipped: bool = False
    skip_reason: str | None = None


@dataclass(frozen=True, slots=True)
class RetrievalCandidate:
    """A candidate retrieved via vector similarity + hard filters."""

    scholarship_id: UUID
    title: str
    similarity_score: float
    hard_filter_passed: bool
    data_version: int


def _normalize_whitespace(text: str) -> str:
    """Normalize whitespace in text for canonical input."""
    return " ".join(text.split())


def build_profile_canonical_input(profile: Mapping[str, Any]) -> str:
    """Build a privacy-minimized canonical text input for profile embedding.

    Only includes non-sensitive, relevant fields for semantic matching.
    Excludes: raw documents, PII beyond country codes, financial details.
    """
    parts = []

    # Study context (non-PII)
    if study_level := profile.get("study_level"):
        parts.append(f"Study level: {study_level}")

    if field_of_study := profile.get("field_of_study"):
        parts.append(f"Field of study: {_normalize_whitespace(field_of_study)}")

    if institution := profile.get("institution_name"):
        # Only institution name, no location details
        parts.append(f"Institution: {_normalize_whitespace(institution)}")

    # Geographic context (country codes only, no addresses)
    if country := profile.get("country"):
        parts.append(f"Country: {country}")

    if nationality := profile.get("nationality_country"):
        parts.append(f"Nationality: {nationality}")

    if residence := profile.get("residence_country"):
        parts.append(f"Residence: {residence}")

    # Interests and goals (user-provided, already sanitized)
    if interests := profile.get("interests"):
        if isinstance(interests, list):
            parts.append(f"Interests: {', '.join(str(i) for i in interests)}")

    if goals := profile.get("goals"):
        parts.append(f"Goals: {_normalize_whitespace(goals)}")

    # Experience (numeric, non-sensitive)
    if experience := profile.get("experience_months"):
        parts.append(f"Experience: {experience} months")

    canonical = " | ".join(parts)
    # Hard limit to prevent oversized inputs
    return canonical[:8000]


def build_scholarship_canonical_input(scholarship: Mapping[str, Any]) -> str:
    """Build a canonical text input for scholarship embedding.

    Uses normalized facts only, excludes raw URLs and internal IDs.
    """
    parts = []

    if title := scholarship.get("title"):
        parts.append(f"Title: {_normalize_whitespace(title)}")

    if description := scholarship.get("description"):
        parts.append(f"Description: {_normalize_whitespace(description)}")

    if funding_type := scholarship.get("funding_type"):
        parts.append(f"Funding type: {funding_type}")

    if study_levels := scholarship.get("study_levels"):
        if isinstance(study_levels, list):
            parts.append(f"Study levels: {', '.join(study_levels)}")

    if fields := scholarship.get("fields_of_study"):
        if isinstance(fields, list):
            parts.append(f"Fields of study: {', '.join(_normalize_whitespace(f) for f in fields)}")

    if destinations := scholarship.get("destination_countries"):
        if isinstance(destinations, list):
            parts.append(f"Destination countries: {', '.join(destinations)}")

    if eligibility := scholarship.get("eligibility_summary"):
        parts.append(f"Eligibility: {_normalize_whitespace(eligibility)}")

    if required_docs := scholarship.get("required_documents"):
        if isinstance(required_docs, list):
            parts.append(f"Required documents: {', '.join(required_docs)}")

    canonical = " | ".join(parts)
    return canonical[:8000]


def compute_content_hash(content: str) -> str:
    """Compute SHA256 hash of canonical content."""
    return hashlib.sha256(content.encode("utf-8")).hexdigest()[:64]


class EmbeddingProvider:
    """Adapter interface for embedding providers."""

    async def generate_embedding(
        self,
        text: str,
        model_name: str,
    ) -> list[float]:
        """Generate embedding vector for text.

        Args:
            text: Canonical text input (already normalized).
            model_name: Approved model identifier.

        Returns:
            List of floats representing the embedding vector.

        Raises:
            ApiError: With code EMBEDDING_GENERATION_FAILED on failure.
        """
        raise NotImplementedError


class EmbeddingService:
    """Service for managing embeddings with versioning and caching."""

    def __init__(
        self,
        provider: EmbeddingProvider,
        active_model: EmbeddingModelConfig,
        embedding_version: int = 1,
    ) -> None:
        self._provider = provider
        self._active_model = active_model
        self._embedding_version = embedding_version

    async def generate_profile_embedding(
        self,
        profile_id: UUID,
        profile_data: Mapping[str, Any],
        existing_hash: str | None = None,
    ) -> EmbeddingResult:
        """Generate or retrieve cached embedding for a profile.

        Skips generation if content hash is unchanged.
        """
        canonical_input = build_profile_canonical_input(profile_data)
        content_hash = compute_content_hash(canonical_input)

        # Skip if content unchanged
        if existing_hash and existing_hash == content_hash:
            return EmbeddingResult(
                entity_id=profile_id,
                entity_type="profile",
                model_name=self._active_model.name,
                dimensions=self._active_model.dimensions,
                content_hash=content_hash,
                entity_data_version=int(profile_data.get("data_version", 1)),
                embedding_version=self._embedding_version,
                embedding=[],
                canonical_input=canonical_input,
                skipped=True,
                skip_reason="content_unchanged",
            )

        try:
            embedding = await self._provider.generate_embedding(
                canonical_input,
                self._active_model.name,
            )
        except ApiError:
            raise
        except Exception as exc:
            raise ApiError(
                status_code=503,
                code="EMBEDDING_GENERATION_FAILED",
                message="Failed to generate profile embedding.",
            ) from exc

        if len(embedding) != self._active_model.dimensions:
            raise ApiError(
                status_code=500,
                code="EMBEDDING_DIMENSION_MISMATCH",
                message=f"Expected {self._active_model.dimensions} dimensions, got {len(embedding)}.",
            )

        return EmbeddingResult(
            entity_id=profile_id,
            entity_type="profile",
            model_name=self._active_model.name,
            dimensions=self._active_model.dimensions,
            content_hash=content_hash,
            entity_data_version=int(profile_data.get("data_version", 1)),
            embedding_version=self._embedding_version,
            embedding=embedding,
            canonical_input=canonical_input,
        )

    async def generate_scholarship_embedding(
        self,
        scholarship_id: UUID,
        scholarship_data: Mapping[str, Any],
        existing_hash: str | None = None,
    ) -> EmbeddingResult:
        """Generate or retrieve cached embedding for a scholarship.

        Skips generation if content hash is unchanged.
        """
        canonical_input = build_scholarship_canonical_input(scholarship_data)
        content_hash = compute_content_hash(canonical_input)

        if existing_hash and existing_hash == content_hash:
            return EmbeddingResult(
                entity_id=scholarship_id,
                entity_type="scholarship",
                model_name=self._active_model.name,
                dimensions=self._active_model.dimensions,
                content_hash=content_hash,
                entity_data_version=int(scholarship_data.get("data_version", 1)),
                embedding_version=self._embedding_version,
                embedding=[],
                canonical_input=canonical_input,
                skipped=True,
                skip_reason="content_unchanged",
            )

        try:
            embedding = await self._provider.generate_embedding(
                canonical_input,
                self._active_model.name,
            )
        except ApiError:
            raise
        except Exception as exc:
            raise ApiError(
                status_code=503,
                code="EMBEDDING_GENERATION_FAILED",
                message="Failed to generate scholarship embedding.",
            ) from exc

        if len(embedding) != self._active_model.dimensions:
            raise ApiError(
                status_code=500,
                code="EMBEDDING_DIMENSION_MISMATCH",
                message=f"Expected {self._active_model.dimensions} dimensions, got {len(embedding)}.",
            )

        return EmbeddingResult(
            entity_id=scholarship_id,
            entity_type="scholarship",
            model_name=self._active_model.name,
            dimensions=self._active_model.dimensions,
            content_hash=content_hash,
            entity_data_version=int(scholarship_data.get("data_version", 1)),
            embedding_version=self._embedding_version,
            embedding=embedding,
            canonical_input=canonical_input,
        )

    def get_active_model(self) -> EmbeddingModelConfig:
        """Return the currently active embedding model config."""
        return self._active_model

    def get_embedding_version(self) -> int:
        """Return the current embedding version for re-indexing tracking."""
        return self._embedding_version
