# ADR-0004: Put Qwen behind an AI adapter

- Status: Accepted
- Date: 2026-07-28

## Context

The platform needs readable summaries and match explanations, while eligibility and ranking must remain reproducible and provider-independent.

## Decision

Call Qwen/DashScope through an application-owned adapter with explicit timeouts, bounded retries, schema-constrained outputs, and model metadata. Qwen may summarize supplied facts and explain deterministic scores; it may not decide hard eligibility or final ranking.

## Consequences

AI failures can degrade to a valid deterministic result, and another provider can replace Qwen without changing domain rules. Prompts, schemas, and model versions require versioning and evaluation. Server credentials and sensitive prompt data must never enter browser bundles or logs.

