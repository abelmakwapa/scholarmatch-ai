# Deterministic matching MVP

ScholarMatch's matching core is deterministic and does not call an LLM. A result is reproducible
from the normalized profile, normalized scholarship and rules, ready-document metadata, scoring
configuration, reference date, and algorithm version. The initial algorithm version is
`deterministic-mvp-v1`.

## Eligibility

Each normalized rule records a field, operator, JSON value, `hard` or `soft` strength, source, and
positive version. The MVP supports country/destination, nationality, residency, study level, field
of study, GPA with an explicit scale, age, date of birth, institution, experience months, and
required-document evidence. Supported comparisons are validated per field before a rule can be
saved.

Every rule produces one of three outcomes:

- `eligible`: available profile evidence confirms the comparison passes.
- `ineligible`: available profile evidence confirms the comparison fails.
- `unknown`: required profile evidence is absent or insufficient.

Missing evidence is never converted into a pass or failure. A scholarship is confirmed ineligible
when at least one hard rule fails. It is unknown when no hard rule fails and at least one hard rule
is unknown; otherwise it is eligible. Soft rules affect the eligibility-fit component but never
exclude a scholarship. A passed deadline creates a hard `SCHOLARSHIP_EXPIRED` failure. Ranked lists
exclude confirmed-ineligible results and retain unknown results with their reason codes and missing
profile fields.

## GPA conversion policy

GPA rules and profiles both require a score and a positive scale. The MVP compares the exact
proportion `score / scale` using decimal arithmetic. For example, 4.0/5.0 equals 3.2/4.0. The policy
does not model grade distributions, letter grades, weighted GPAs, institutional prestige, or
non-linear country/institution conversion tables. Those cases remain unknown until an approved,
auditable conversion policy is introduced; catalog reviewers must not encode a guessed conversion.

## Score formulas

Every component is in the closed interval 0–1 and records the formula/algorithm version. Confirmed
pass, unknown, and confirmed failure contribute 1.0, 0.5, and 0.0 respectively where rule outcomes
are scored.

- Academic fit is the arithmetic mean of the applicable study-level comparison, deterministic
  field-of-study token overlap, and GPA rule outcomes. Missing applicable profile evidence is 0.5.
- Eligibility fit is the mean hard-rule outcome when no soft rules exist. With soft rules, it is
  `0.70 × hard mean + 0.30 × soft mean`.
- Interests/goals fit is case-folded word-token Jaccard overlap between profile interests/goals and
  scholarship title, description, fields, and eligibility summary. Missing evidence is neutral at
  0.5. This is lexical overlap, not semantic inference.
- Experience fit is the mean experience-rule outcome. It is 1.0 when the scholarship declares no
  experience requirement.
- Readiness/timing is `0.60 × ready required-document fraction + 0.40 × timing`. Timing is 0.0 after
  deadline, 0.4 under 14 days, 0.6 under 30 days, 0.8 under 90 days, 1.0 at 90 days or more, and 0.7
  when no deadline is known.

The total is the weighted sum. Default weights are academic 0.30, eligibility 0.30,
interests/goals 0.15, experience 0.10, and readiness/timing 0.15. Configuration validation rejects
weights outside 0–1 or totals other than 1.0.

Confidence is separate from score. It is the fraction of expected evidence fields that are known
for the scholarship's rules and scoring inputs. It does not alter rank and must not be presented as
the probability of receiving an award.

## Persistence, ordering, and recalculation

Materialized rows store component scores, weights, weighted scores, rule evidence, total,
confidence, profile input version, scholarship version, algorithm version, and calculation time.
The unique profile/scholarship row is updated only when an input version or algorithm version is no
longer current. Repeating recalculation for identical versions returns the existing result. A
scholarship version change recalculates only that scholarship; a profile version or algorithm
change invalidates the corresponding set.

Ranking is stable by total score descending and match UUID ascending. The opaque cursor binds both
values, so ties cannot reorder between pages. Small workloads calculate immediately. Workloads over
`MATCHING_IMMEDIATE_LIMIT` create one idempotent job per profile version and algorithm version and
return HTTP 202; production must provide the durable worker consuming that queue interface.

## Limitations

The engine does not infer requirements from prose, calculate award probability, predict reviewer
behavior, resolve contradictory source rules, use embeddings, or call an LLM. Contradictory hard
rules remain visible and any confirmed failure makes the scholarship ineligible. Dates use the
service's explicit reference date; time-of-day and source timezone handling remain catalog
normalization concerns. Lexical token overlap is intentionally simple and favors explainability
over recall. A score is a deterministic prioritization aid, not an eligibility guarantee or an
admissions decision.
