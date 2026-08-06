import re
from collections.abc import Mapping, Sequence
from datetime import date
from decimal import Decimal
from typing import Any, Literal
from uuid import UUID

from app.schemas.match import (
    DeterministicMatchResult,
    EligibilityResult,
    GPATarget,
    NormalizedRule,
    RuleField,
    RuleOperator,
    RuleOutcome,
    RuleResult,
    RuleSource,
    RuleStrength,
    ScoreComponent,
    ScoringWeights,
)

ALGORITHM_VERSION = "deterministic-mvp-v1"
_TOKEN = re.compile(r"[a-z0-9]+")


def normalize_requirement(row: Mapping[str, Any]) -> NormalizedRule:
    evidence = row.get("source_evidence")
    source_data = evidence if isinstance(evidence, Mapping) else {}
    return NormalizedRule(
        id=UUID(str(row["id"])),
        field=RuleField(str(row["field"])),
        operator=RuleOperator(str(row["operator"])),
        value=row["value"],
        strength=RuleStrength(str(row["constraint_type"])),
        source=RuleSource(
            name=str(source_data.get("source") or source_data.get("label") or "normalized_catalog"),
            source_url=(str(source_data["source_url"]) if source_data.get("source_url") else None),
            summary=(str(source_data["summary"]) if source_data.get("summary") else None),
        ),
        version=int(row["version"]),
    )


def _known(value: object) -> bool:
    if value is None:
        return False
    if isinstance(value, str | list | tuple | set):
        return bool(value)
    return True


def _profile_field(rule_field: RuleField) -> str:
    return {
        RuleField.COUNTRY: "country",
        RuleField.DESTINATION: "target_countries",
        RuleField.NATIONALITY: "nationality_country",
        RuleField.RESIDENCY: "residence_country",
        RuleField.STUDY_LEVEL: "study_level",
        RuleField.FIELD_OF_STUDY: "field_of_study",
        RuleField.GPA: "gpa",
        RuleField.AGE: "date_of_birth",
        RuleField.DATE_OF_BIRTH: "date_of_birth",
        RuleField.INSTITUTION: "institution_name",
        RuleField.EXPERIENCE: "experience_months",
        RuleField.EXPERIENCE_MONTHS: "experience_months",
        RuleField.DOCUMENT: "ready_document_types",
    }.get(rule_field, rule_field.value)


def _age_on(date_of_birth: date, reference_date: date) -> int:
    return (
        reference_date.year
        - date_of_birth.year
        - ((reference_date.month, reference_date.day) < (date_of_birth.month, date_of_birth.day))
    )


def _normalized_text(value: object) -> str:
    return " ".join(str(value).casefold().split())


def _text_compare(profile_value: object, operator: RuleOperator, target: object) -> bool:
    profile_values = (
        [_normalized_text(item) for item in profile_value]
        if isinstance(profile_value, list | tuple | set)
        else [_normalized_text(profile_value)]
    )
    targets = (
        [_normalized_text(item) for item in target]
        if isinstance(target, list)
        else [_normalized_text(target)]
    )
    intersects = bool(set(profile_values) & set(targets))
    if operator is RuleOperator.EQUALS:
        return intersects
    if operator is RuleOperator.NOT_EQUALS:
        return not intersects
    if operator is RuleOperator.IN:
        return intersects
    if operator is RuleOperator.NOT_IN:
        return not intersects
    if operator is RuleOperator.CONTAINS:
        return any(target_value in value for value in profile_values for target_value in targets)
    return False


def _numeric_compare(value: int, operator: RuleOperator, target: object) -> bool:
    if operator is RuleOperator.IN:
        if isinstance(target, list):
            return any(isinstance(item, int) and value == item for item in target)
        return isinstance(target, int) and value == target
    if not isinstance(target, int):
        return False
    target_value = target
    if operator is RuleOperator.EQUALS:
        return value == target_value
    if operator is RuleOperator.GTE:
        return value >= target_value
    if operator is RuleOperator.LTE:
        return value <= target_value
    return False


def _date_compare(value: date, operator: RuleOperator, target: object) -> bool:
    target_date = target if isinstance(target, date) else date.fromisoformat(str(target))
    if operator is RuleOperator.EQUALS:
        return value == target_date
    if operator is RuleOperator.GTE:
        return value >= target_date
    if operator is RuleOperator.LTE:
        return value <= target_date
    return False


def _gpa_compare(
    profile_gpa: object,
    profile_scale: object,
    operator: RuleOperator,
    target: object,
) -> bool:
    rule_gpa = GPATarget.model_validate(target)
    profile_ratio = Decimal(str(profile_gpa)) / Decimal(str(profile_scale))
    target_ratio = Decimal(str(rule_gpa.score)) / Decimal(str(rule_gpa.scale))
    if operator is RuleOperator.EQUALS:
        return profile_ratio == target_ratio
    if operator is RuleOperator.GTE:
        return profile_ratio >= target_ratio
    if operator is RuleOperator.LTE:
        return profile_ratio <= target_ratio
    return False


def evaluate_rule(
    rule: NormalizedRule,
    profile: Mapping[str, Any],
    *,
    reference_date: date,
) -> RuleResult:
    profile_field = _profile_field(rule.field)
    missing = [profile_field]
    profile_value = profile.get(profile_field)
    if rule.operator is RuleOperator.EXISTS:
        if rule.field is RuleField.GPA:
            missing = [name for name in ("gpa", "gpa_scale") if not _known(profile.get(name))]
            if missing:
                return _unknown(rule, missing)
            passed = True
        elif not _known(profile_value):
            return _unknown(rule, missing)
        else:
            passed = True
    elif rule.field is RuleField.GPA:
        missing = [name for name in ("gpa", "gpa_scale") if not _known(profile.get(name))]
        if missing:
            return _unknown(rule, missing)
        passed = _gpa_compare(profile["gpa"], profile["gpa_scale"], rule.operator, rule.value)
    elif rule.field is RuleField.AGE:
        if not isinstance(profile_value, date):
            return _unknown(rule, missing)
        passed = _numeric_compare(_age_on(profile_value, reference_date), rule.operator, rule.value)
    elif rule.field is RuleField.DATE_OF_BIRTH:
        if not isinstance(profile_value, date):
            return _unknown(rule, missing)
        passed = _date_compare(profile_value, rule.operator, rule.value)
    elif rule.field in {RuleField.EXPERIENCE, RuleField.EXPERIENCE_MONTHS}:
        if not isinstance(profile_value, int):
            return _unknown(rule, missing)
        passed = _numeric_compare(profile_value, rule.operator, rule.value)
    elif rule.field in {
        RuleField.COUNTRY,
        RuleField.DESTINATION,
        RuleField.NATIONALITY,
        RuleField.RESIDENCY,
        RuleField.STUDY_LEVEL,
        RuleField.FIELD_OF_STUDY,
        RuleField.INSTITUTION,
        RuleField.DOCUMENT,
    }:
        if not _known(profile_value):
            return _unknown(rule, missing)
        passed = _text_compare(profile_value, rule.operator, rule.value)
    else:
        return _unknown(rule, [profile_field], reason_code="RULE_NOT_SUPPORTED")
    return RuleResult(
        rule_id=rule.id,
        field=rule.field,
        operator=rule.operator,
        strength=rule.strength,
        outcome=RuleOutcome.ELIGIBLE if passed else RuleOutcome.INELIGIBLE,
        reason_code="RULE_CONFIRMED_PASS" if passed else "RULE_CONFIRMED_FAIL",
        message=(
            "The available profile evidence satisfies this rule."
            if passed
            else "The available profile evidence does not satisfy this rule."
        ),
        source=rule.source,
        rule_version=rule.version,
    )


def _unknown(
    rule: NormalizedRule,
    missing: list[str],
    *,
    reason_code: str = "PROFILE_EVIDENCE_MISSING",
) -> RuleResult:
    return RuleResult(
        rule_id=rule.id,
        field=rule.field,
        operator=rule.operator,
        strength=rule.strength,
        outcome=RuleOutcome.UNKNOWN,
        reason_code=reason_code,
        message="The profile does not contain enough evidence to decide this rule.",
        missing_profile_fields=sorted(set(missing)),
        source=rule.source,
        rule_version=rule.version,
    )


def evaluate_eligibility(
    profile: Mapping[str, Any],
    scholarship: Mapping[str, Any],
    rules: Sequence[NormalizedRule],
    *,
    reference_date: date,
) -> EligibilityResult:
    results = [evaluate_rule(rule, profile, reference_date=reference_date) for rule in rules]
    deadline = scholarship.get("deadline")
    if isinstance(deadline, date) and deadline < reference_date:
        results.append(
            RuleResult(
                rule_id=None,
                field=RuleField.DEADLINE,
                operator=RuleOperator.GTE,
                strength=RuleStrength.HARD,
                outcome=RuleOutcome.INELIGIBLE,
                reason_code="SCHOLARSHIP_EXPIRED",
                message="The scholarship deadline has passed.",
                source=RuleSource(name="normalized_catalog"),
                rule_version=int(scholarship.get("data_version", 1)),
            )
        )
    hard = [result for result in results if result.strength is RuleStrength.HARD]
    soft = [result for result in results if result.strength is RuleStrength.SOFT]
    if any(result.outcome is RuleOutcome.INELIGIBLE for result in hard):
        outcome = RuleOutcome.INELIGIBLE
    elif any(result.outcome is RuleOutcome.UNKNOWN for result in hard):
        outcome = RuleOutcome.UNKNOWN
    else:
        outcome = RuleOutcome.ELIGIBLE
    missing = sorted({field for result in results for field in result.missing_profile_fields})
    reasons = [
        result.reason_code for result in results if result.outcome is not RuleOutcome.ELIGIBLE
    ]
    return EligibilityResult(
        outcome=outcome,
        hard_rule_results=hard,
        soft_rule_results=soft,
        reasons=reasons,
        missing_profile_fields=missing,
    )


def _outcome_score(outcome: RuleOutcome) -> float:
    return {
        RuleOutcome.ELIGIBLE: 1.0,
        RuleOutcome.UNKNOWN: 0.5,
        RuleOutcome.INELIGIBLE: 0.0,
    }[outcome]


def _average(values: Sequence[float], *, default: float = 1.0) -> float:
    return sum(values) / len(values) if values else default


def _tokens(value: object) -> set[str]:
    if value is None:
        return set()
    if isinstance(value, list | tuple | set):
        text = " ".join(str(item) for item in value)
    else:
        text = str(value)
    return set(_TOKEN.findall(text.casefold()))


def _semantic_overlap(profile: Mapping[str, Any], scholarship: Mapping[str, Any]) -> float:
    profile_tokens = _tokens(profile.get("interests")) | _tokens(profile.get("goals"))
    if not profile_tokens:
        return 0.5
    scholarship_tokens = (
        _tokens(scholarship.get("title"))
        | _tokens(scholarship.get("description"))
        | _tokens(scholarship.get("fields_of_study"))
        | _tokens(scholarship.get("eligibility_summary"))
    )
    if not scholarship_tokens:
        return 0.5
    return len(profile_tokens & scholarship_tokens) / len(profile_tokens | scholarship_tokens)


def _academic_fit(
    profile: Mapping[str, Any],
    scholarship: Mapping[str, Any],
    rule_results: Sequence[RuleResult],
) -> tuple[float, list[str]]:
    scores: list[float] = []
    evidence: list[str] = []
    study_levels = scholarship.get("study_levels") or []
    if study_levels:
        study_level = profile.get("study_level")
        scores.append(0.5 if not _known(study_level) else float(study_level in study_levels))
        evidence.append("study_level")
    fields = scholarship.get("fields_of_study") or []
    if fields:
        profile_field = profile.get("field_of_study")
        if not _known(profile_field):
            scores.append(0.5)
        else:
            profile_tokens = _tokens(profile_field)
            similarities = []
            for field in fields:
                target_tokens = _tokens(field)
                union = target_tokens | profile_tokens
                similarities.append(
                    len(target_tokens & profile_tokens) / len(union) if union else 1.0
                )
            scores.append(max(similarities))
        evidence.append("field_of_study")
    gpa_results = [result for result in rule_results if result.field is RuleField.GPA]
    if gpa_results:
        scores.append(_average([_outcome_score(result.outcome) for result in gpa_results]))
        evidence.extend(["gpa", "gpa_scale"])
    return _average(scores), sorted(set(evidence))


def _eligibility_fit(eligibility: EligibilityResult) -> tuple[float, list[str]]:
    hard_score = _average(
        [_outcome_score(result.outcome) for result in eligibility.hard_rule_results]
    )
    if eligibility.soft_rule_results:
        soft_score = _average(
            [_outcome_score(result.outcome) for result in eligibility.soft_rule_results]
        )
        score = 0.7 * hard_score + 0.3 * soft_score
    else:
        score = hard_score
    evidence = sorted(
        {
            _profile_field(result.field)
            for result in eligibility.hard_rule_results + eligibility.soft_rule_results
            if result.field is not RuleField.DEADLINE
        }
    )
    return score, evidence


def _experience_fit(eligibility: EligibilityResult) -> tuple[float, list[str]]:
    results = [
        result
        for result in eligibility.hard_rule_results + eligibility.soft_rule_results
        if result.field in {RuleField.EXPERIENCE, RuleField.EXPERIENCE_MONTHS}
    ]
    return (
        _average([_outcome_score(result.outcome) for result in results]),
        ["experience_months"] if results else [],
    )


def _readiness_timing(
    scholarship: Mapping[str, Any],
    documents: Sequence[Mapping[str, Any]],
    *,
    reference_date: date,
) -> tuple[float, list[str]]:
    required = {_normalized_text(item) for item in scholarship.get("required_documents") or []}
    ready = {
        _normalized_text(document.get("document_type"))
        for document in documents
        if document.get("status") == "ready"
    }
    document_score = len(required & ready) / len(required) if required else 1.0
    deadline = scholarship.get("deadline")
    if not isinstance(deadline, date):
        timing_score = 0.7
    else:
        days = (deadline - reference_date).days
        if days < 0:
            timing_score = 0.0
        elif days < 14:
            timing_score = 0.4
        elif days < 30:
            timing_score = 0.6
        elif days < 90:
            timing_score = 0.8
        else:
            timing_score = 1.0
    return 0.6 * document_score + 0.4 * timing_score, ["documents", "deadline"]


def _confidence(
    profile: Mapping[str, Any],
    scholarship: Mapping[str, Any],
    rules: Sequence[NormalizedRule],
) -> float:
    expected: set[str] = {"study_level"}
    if scholarship.get("fields_of_study"):
        expected.add("field_of_study")
    if any(
        scholarship.get(field)
        for field in ("title", "description", "fields_of_study", "eligibility_summary")
    ):
        expected.add("interests_or_goals")
    for rule in rules:
        if rule.field is RuleField.GPA:
            expected.update({"gpa", "gpa_scale"})
        elif rule.field is not RuleField.DEADLINE:
            expected.add(_profile_field(rule.field))
    known = 0
    for field in expected:
        if field == "interests_or_goals":
            known += int(_known(profile.get("interests")) or _known(profile.get("goals")))
        elif field == "ready_document_types":
            known += 1
        else:
            known += int(_known(profile.get(field)))
    return known / len(expected) if expected else 1.0


def calculate_match(
    profile: Mapping[str, Any],
    scholarship: Mapping[str, Any],
    rules: Sequence[NormalizedRule],
    documents: Sequence[Mapping[str, Any]],
    *,
    weights: ScoringWeights,
    reference_date: date,
    algorithm_version: str = ALGORITHM_VERSION,
) -> DeterministicMatchResult:
    profile_with_documents = dict(profile)
    profile_with_documents["ready_document_types"] = [
        document["document_type"] for document in documents if document.get("status") == "ready"
    ]
    eligibility = evaluate_eligibility(
        profile_with_documents,
        scholarship,
        rules,
        reference_date=reference_date,
    )
    all_rule_results = eligibility.hard_rule_results + eligibility.soft_rule_results
    academic_score, academic_evidence = _academic_fit(
        profile_with_documents, scholarship, all_rule_results
    )
    eligibility_score, eligibility_evidence = _eligibility_fit(eligibility)
    interests_score = _semantic_overlap(profile_with_documents, scholarship)
    experience_score, experience_evidence = _experience_fit(eligibility)
    readiness_score, readiness_evidence = _readiness_timing(
        scholarship, documents, reference_date=reference_date
    )
    component_name = Literal[
        "academic_fit",
        "eligibility_fit",
        "interests_goals",
        "experience",
        "readiness_timing",
    ]
    raw_components: list[tuple[component_name, float, float, list[str]]] = [
        ("academic_fit", academic_score, weights.academic_fit, academic_evidence),
        ("eligibility_fit", eligibility_score, weights.eligibility_fit, eligibility_evidence),
        (
            "interests_goals",
            interests_score,
            weights.interests_goals,
            ["interests", "goals"],
        ),
        ("experience", experience_score, weights.experience, experience_evidence),
        ("readiness_timing", readiness_score, weights.readiness_timing, readiness_evidence),
    ]
    components = [
        ScoreComponent(
            name=name,
            formula_version=algorithm_version,
            score=round(score, 5),
            weight=weight,
            weighted_score=round(score * weight, 5),
            evidence=evidence,
        )
        for name, score, weight, evidence in raw_components
    ]
    total = sum(
        (
            Decimal(str(component.score)) * Decimal(str(component.weight))
            for component in components
        ),
        start=Decimal("0"),
    )
    return DeterministicMatchResult(
        scholarship_id=UUID(str(scholarship["id"])),
        eligibility=eligibility,
        components=components,
        total_score=float(total.quantize(Decimal("0.00001"))),
        confidence=round(_confidence(profile_with_documents, scholarship, rules), 5),
        algorithm_version=algorithm_version,
    )
