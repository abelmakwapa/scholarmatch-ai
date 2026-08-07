"""Qwen explanation adapter for deterministic match results.

This module provides a strict, schema-validated explanation service that:
- Sends only normalized scholarship facts and deterministic rule results
- Requires a strict output schema with summary, supporting_reasons, blockers, etc.
- Implements timeouts, bounded retries, rate limits, and usage/cost metadata
- Validates every response with Pydantic
- Caches by match input/version/model/prompt version
- Falls back gracefully on failure without affecting deterministic matches
"""

import hashlib
import json
import time
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, Literal
from uuid import UUID

import httpx
from pydantic import BaseModel, Field, ValidationError, field_validator

from app.core.errors import ApiError
from app.schemas.match import EligibilityResult, RuleOutcome, RuleResult, ScoreComponent


class ExplanationSummary(BaseModel):
    """Brief summary of the match outcome."""

    outcome: Literal["eligible", "ineligible", "partial"]
    one_line_summary: str = Field(max_length=500)


class ExplanationReason(BaseModel):
    """A single supporting reason or blocker."""

    category: Literal[
        "eligibility_rule",
        "academic_fit",
        "experience",
        "document_readiness",
        "timing",
        "missing_information",
    ]
    description: str = Field(min_length=1, max_length=1000)
    severity: Literal["critical", "moderate", "minor"] | None = None


class QwenExplanationSchema(BaseModel):
    """Strict schema for Qwen explanation responses.

    Never describes scores as probabilities of award.
    """

    summary: ExplanationSummary
    supporting_reasons: list[ExplanationReason] = Field(default_factory=list)
    blockers: list[ExplanationReason] = Field(default_factory=list)
    missing_information: list[str] = Field(default_factory=list)
    next_actions: list[str] = Field(default_factory=list)

    @field_validator("supporting_reasons", "blockers", mode="after")
    @classmethod
    def validate_reasons(cls, values: list[ExplanationReason]) -> list[ExplanationReason]:
        if not values:
            return values
        # Ensure no probability claims
        for reason in values:
            text = reason.description.lower()
            if any(phrase in text for phrase in ["probability", "chance of winning", "likely to receive"]):
                raise ValueError("Explanations must not describe scores as probabilities of award")
        return values


@dataclass(frozen=True, slots=True)
class ExplanationCacheKey:
    """Cache key components for explanation lookup."""

    match_input_hash: str
    model_name: str
    prompt_version: str

    def to_cache_key(self) -> str:
        return f"{self.match_input_hash}:{self.model_name}:{self.prompt_version}"


@dataclass(frozen=True, slots=True)
class ExplanationResult:
    """Result of generating an explanation."""

    explanation: QwenExplanationSchema
    model_name: str
    prompt_version: str
    tokens_used: int
    cost_micros: int | None
    cached: bool
    generated_at: datetime


@dataclass(frozen=True, slots=True)
class ExplanationStatus:
    """Status of explanation generation."""

    status: Literal["ready", "pending", "unavailable", "failed"]
    last_attempt: datetime | None = None
    retry_count: int = 0
    error_code: str | None = None


class QwenExplanationProvider:
    """Adapter for Qwen API with strict validation and fallback behavior."""

    DEFAULT_PROMPT_VERSION = "v1"
    MAX_RETRIES = 2
    TIMEOUT_SECONDS = 15.0
    RATE_LIMIT_DELAY_MS = 100

    def __init__(
        self,
        api_key: str,
        api_url: str,
        model_name: str = "qwen-plus",
        prompt_version: str = DEFAULT_PROMPT_VERSION,
        max_retries: int = MAX_RETRIES,
        timeout_seconds: float = TIMEOUT_SECONDS,
    ) -> None:
        self._api_key = api_key
        self._api_url = api_url
        self._model_name = model_name
        self._prompt_version = prompt_version
        self._max_retries = max_retries
        self._timeout_seconds = timeout_seconds
        self._last_request_time: float = 0

    def _build_prompt(
        self,
        scholarship_facts: Mapping[str, Any],
        eligibility: EligibilityResult,
        score_components: Sequence[ScoreComponent],
        profile_facts: Mapping[str, Any],
    ) -> str:
        """Build the prompt with only approved facts."""
        # Normalize eligibility outcome
        outcome_label = {
            RuleOutcome.ELIGIBLE: "eligible",
            RuleOutcome.INELIGIBLE: "ineligible",
            RuleOutcome.UNKNOWN: "partial",
        }.get(eligibility.outcome, "partial")

        # Build scholarship facts section (normalized only)
        scholarship_text = []
        if title := scholarship_facts.get("title"):
            scholarship_text.append(f"- Title: {title}")
        if funding_type := scholarship_facts.get("funding_type"):
            scholarship_text.append(f"- Funding: {funding_type}")
        if study_levels := scholarship_facts.get("study_levels"):
            scholarship_text.append(f"- Study levels: {', '.join(study_levels)}")
        if fields := scholarship_facts.get("fields_of_study"):
            scholarship_text.append(f"- Fields: {', '.join(fields)}")
        if deadline := scholarship_facts.get("deadline"):
            scholarship_text.append(f"- Deadline: {deadline}")

        # Build rule results summary
        hard_rules = []
        soft_rules = []
        for rule in eligibility.hard_rule_results:
            status = "PASS" if rule.outcome == RuleOutcome.ELIGIBLE else ("FAIL" if rule.outcome == RuleOutcome.INELIGIBLE else "UNKNOWN")
            hard_rules.append(f"  - [{rule.strength.value.upper()}] {rule.field.value}: {status}")
        for rule in eligibility.soft_rule_results:
            status = "PASS" if rule.outcome == RuleOutcome.ELIGIBLE else ("FAIL" if rule.outcome == RuleOutcome.INELIGIBLE else "UNKNOWN")
            soft_rules.append(f"  - [{rule.strength.value.upper()}] {rule.field.value}: {status}")

        # Build score components (without calling it probability)
        score_text = []
        for comp in score_components:
            score_text.append(f"  - {comp.name}: {comp.score:.2f} (weight: {comp.weight:.2f})")

        # Build approved profile facts
        profile_text = []
        if study_level := profile_facts.get("study_level"):
            profile_text.append(f"- Study level: {study_level}")
        if field := profile_facts.get("field_of_study"):
            profile_text.append(f"- Field of study: {field}")
        if country := profile_facts.get("country"):
            profile_text.append(f"- Country: {country}")
        if gpa := profile_facts.get("gpa"):
            scale = profile_facts.get("gpa_scale", "N/A")
            profile_text.append(f"- GPA: {gpa}/{scale}")

        prompt = f"""You are explaining a deterministic scholarship match result. Use ONLY the provided facts.

SCHOLARSHIP FACTS:
{chr(10).join(scholarship_text) if scholarship_text else "- No additional facts"}

ELIGIBILITY OUTCOME: {outcome_label}

HARD RULE RESULTS:
{chr(10).join(hard_rules) if hard_rules else "- None evaluated"}

SOFT RULE RESULTS:
{chr(10).join(soft_rules) if soft_rules else "- None evaluated"}

SCORE COMPONENTS (NOT probabilities of award):
{chr(10).join(score_text) if score_text else "- None calculated"}

APPROVED PROFILE FACTS:
{chr(10).join(profile_text) if profile_text else "- No profile facts available"}

MISSING PROFILE FIELDS: {', '.join(eligibility.missing_profile_fields) if eligibility.missing_profile_fields else 'None'}

Generate a JSON response following this exact schema:
{{
  "summary": {{"outcome": "{outcome_label}", "one_line_summary": "string (max 500 chars)"}},
  "supporting_reasons": [{{"category": "eligibility_rule|academic_fit|experience|document_readiness|timing|missing_information", "description": "string", "severity": "critical|moderate|minor|null"}}],
  "blockers": [same schema as supporting_reasons],
  "missing_information": ["string"],
  "next_actions": ["string"]
}}

RULES:
1. Never describe the match score as a probability of receiving the award.
2. Base all explanations strictly on the provided facts above.
3. Do not invent scholarship requirements or criteria not listed.
4. If information is missing, list it in missing_information.
5. Provide actionable next_steps based on missing_information or blockers.
6. Keep descriptions concise and factual."""

        return prompt

    def _compute_input_hash(
        self,
        scholarship_facts: Mapping[str, Any],
        eligibility: EligibilityResult,
        score_components: Sequence[ScoreComponent],
        profile_facts: Mapping[str, Any],
    ) -> str:
        """Compute hash of input for cache lookup."""
        input_data = {
            "scholarship": dict(scholarship_facts),
            "eligibility_outcome": eligibility.outcome.value,
            "hard_rules": len(eligibility.hard_rule_results),
            "soft_rules": len(eligibility.soft_rule_results),
            "score_components": [c.model_dump() for c in score_components],
            "profile_keys": sorted(profile_facts.keys()),
            "missing_fields": eligibility.missing_profile_fields,
        }
        content = json.dumps(input_data, sort_keys=True, default=str)
        return hashlib.sha256(content.encode()).hexdigest()[:64]

    async def generate_explanation(
        self,
        scholarship_facts: Mapping[str, Any],
        eligibility: EligibilityResult,
        score_components: Sequence[ScoreComponent],
        profile_facts: Mapping[str, Any],
        cached_explanation: QwenExplanationSchema | None = None,
    ) -> ExplanationResult:
        """Generate or retrieve cached explanation.

        Args:
            scholarship_facts: Normalized scholarship data.
            eligibility: Deterministic eligibility result.
            score_components: Score breakdown from matching engine.
            profile_facts: Approved profile facts for context.
            cached_explanation: Previously cached explanation if available.

        Returns:
            ExplanationResult with validated explanation.

        Raises:
            ApiError: With code EXPLANATION_GENERATION_FAILED on persistent failure.
        """
        input_hash = self._compute_input_hash(
            scholarship_facts, eligibility, score_components, profile_facts
        )
        cache_key = ExplanationCacheKey(
            match_input_hash=input_hash,
            model_name=self._model_name,
            prompt_version=self._prompt_version,
        )

        # Return cached if available and valid
        if cached_explanation is not None:
            return ExplanationResult(
                explanation=cached_explanation,
                model_name=self._model_name,
                prompt_version=self._prompt_version,
                tokens_used=0,
                cost_micros=0,
                cached=True,
                generated_at=datetime.now(UTC),
            )

        prompt = self._build_prompt(
            scholarship_facts, eligibility, score_components, profile_facts
        )

        last_error: Exception | None = None
        for attempt in range(self._max_retries + 1):
            try:
                # Rate limiting
                elapsed = time.time() - self._last_request_time
                if elapsed < self.RATE_LIMIT_DELAY_MS / 1000:
                    await asyncio.sleep((self.RATE_LIMIT_DELAY_MS / 1000) - elapsed)

                self._last_request_time = time.time()

                async with httpx.AsyncClient(timeout=self._timeout_seconds) as client:
                    response = await client.post(
                        self._api_url,
                        headers={
                            "Authorization": f"Bearer {self._api_key}",
                            "Content-Type": "application/json",
                        },
                        json={
                            "model": self._model_name,
                            "messages": [
                                {"role": "system", "content": "You are a helpful assistant that explains scholarship match results using strict JSON schemas."},
                                {"role": "user", "content": prompt},
                            ],
                            "response_format": {"type": "json_object"},
                            "temperature": 0.1,
                            "max_tokens": 1000,
                        },
                    )

                if response.status_code == 429:
                    last_error = ApiError(
                        status_code=429,
                        code="RATE_LIMIT_EXCEEDED",
                        message="Rate limit exceeded for explanation generation.",
                    )
                    continue

                if response.status_code >= 500:
                    last_error = ApiError(
                        status_code=503,
                        code="UPSTREAM_SERVICE_ERROR",
                        message="Upstream service error during explanation generation.",
                    )
                    continue

                response.raise_for_status()
                data = response.json()

                # Extract usage info
                usage = data.get("usage", {})
                tokens_used = usage.get("total_tokens", 0)

                # Parse and validate response
                choice = data.get("choices", [{}])[0]
                message = choice.get("message", {})
                content = message.get("content", "")

                try:
                    explanation_data = json.loads(content)
                except json.JSONDecodeError as exc:
                    raise ApiError(
                        status_code=500,
                        code="INVALID_JSON_RESPONSE",
                        message="Qwen returned malformed JSON.",
                    ) from exc

                try:
                    explanation = QwenExplanationSchema.model_validate(explanation_data)
                except ValidationError as exc:
                    raise ApiError(
                        status_code=500,
                        code="SCHEMA_VALIDATION_FAILED",
                        message="Qwen response does not match required schema.",
                    ) from exc

                # Estimate cost (micros per token - adjust based on actual pricing)
                cost_micros = tokens_used * 50  # Example: 50 micros per 1K tokens

                return ExplanationResult(
                    explanation=explanation,
                    model_name=self._model_name,
                    prompt_version=self._prompt_version,
                    tokens_used=tokens_used,
                    cost_micros=cost_micros,
                    cached=False,
                    generated_at=datetime.now(UTC),
                )

            except ApiError:
                raise
            except Exception as exc:
                last_error = exc
                if attempt < self._max_retries:
                    await asyncio.sleep(0.5 * (attempt + 1))
                continue

        # All retries exhausted
        raise ApiError(
            status_code=503,
            code="EXPLANATION_GENERATION_FAILED",
            message="Failed to generate explanation after retries.",
        ) from last_error


# Import asyncio at module level for retry logic
import asyncio
