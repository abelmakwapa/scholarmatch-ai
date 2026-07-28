# ADR-0001: Start with a modular monolith

- Status: Accepted
- Date: 2026-07-28

## Context

The MVP needs clear profile, scholarship, matching, application, and administration boundaries without the operational cost of distributed services.

## Decision

Build one deployable FastAPI application organized by domain, plus a separately run worker that imports the same application and domain services. Keep routers thin and isolate persistence and external providers behind interfaces.

## Consequences

Transactions, local development, and deployments remain simple. Domain boundaries must be enforced through code structure and tests. Extract a service only when measured scaling or ownership constraints justify it.

