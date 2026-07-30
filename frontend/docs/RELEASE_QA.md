# Frontend release QA — 29 July 2026

Scope: the public marketing page, authentication entry, authenticated student
shell, and role-protected administration shell. Measurements are local
production-build lab results from this machine, not field data or invented
Lighthouse scores.

## Coverage

- Playwright engines: Chromium, Firefox, and WebKit, plus Chromium using the
  Pixel 5 mobile profile.
- Responsive review: 320, 375, 768, 1024, 1280, and 1440 CSS pixels. Every
  width retained the full headline and reported `scrollWidth <= clientWidth`.
- Accessibility modes: keyboard-only menu and tabs, 200% zoom reflow
  equivalent, `prefers-reduced-motion`, forced colors, and increased contrast.
- Representative semantic snapshots: marketing exposed skip link, banner,
  named navigation, one main landmark, ordered headings, labelled regions, and
  content information; sign-in exposed its labelled email/password fields,
  password disclosure, recovery link, submit control, and live error region in
  reading order.

## Accessibility findings

The baseline browser audit found 11 contrast failures and 23 interactive
targets below the WCAG 2.2 24-by-24 CSS-pixel minimum. The hardening pass raised
muted text contrast, increased link/control hit areas, added forced-colors and
increased-contrast treatments, restored focus after mobile menus, trapped focus
inside destructive admin confirmations, and made Escape behavior consistent.
Decorative and autoplay motion now stops under reduced motion while all content
remains available.

Final automated axe checks report zero WCAG 2.2 A/AA violations on marketing
and sign-in in the covered engines. Landmark/heading, keyboard, target-size,
zoom, reduced-motion, forced-colors, not-found, offline, and no-console-error
checks pass. Component tests also cover navigation, tabs, carousel behavior,
role protection, profile updates, document deletion, admin dialogs, empty/error
states, and privacy policy enforcement.

## Performance measurements

Baseline static output was 1,550,311 B of JavaScript, 98,865 B of CSS, and
290,520 B of self-hosted fonts. After adding reliability boundaries and minimal
operational instrumentation, the complete application output is 1,579,561 B of
JavaScript, 101,358 B of CSS, and 290,520 B of fonts. The public route currently
loads 93,909 B of route JavaScript. Its matching and story motion was moved from
Framer Motion to CSS, leaving client components only for menu, tabs, and
carousel interaction.

Checked-in build limits and current measurements:

| Measurement                |     Current |      Budget |
| -------------------------- | ----------: | ----------: |
| All static JavaScript      | 1,579,561 B | 1,700,000 B |
| Largest JavaScript chunk   |   251,395 B |   270,000 B |
| All CSS                    |   101,358 B |   105,000 B |
| Self-hosted fonts          |   290,520 B |   300,000 B |
| Marketing route JavaScript |    93,909 B |   100,000 B |
| Sign-in route JavaScript   |   353,047 B |   365,000 B |
| Dashboard route JavaScript |   101,565 B |   110,000 B |
| Admin route JavaScript     |    98,156 B |   105,000 B |

Cross-engine local lab ranges from the final production build:

| Route      |       LCP |      CLS | Observed interaction latency |          Transfer |
| ---------- | --------: | -------: | ---------------------------: | ----------------: |
| `/`        |  50–61 ms |        0 |                      0–48 ms | 248,921–250,823 B |
| `/sign-in` | 77–115 ms | 0–0.0147 |                         0 ms | 345,734–349,040 B |

These numbers enforce regression ceilings of 2,500 ms LCP, 0.1 CLS, and 200 ms
interaction latency in the local harness. Real-user Core Web Vitals must replace
lab-only interpretation once production traffic exists.

## Test results

- Format check, ESLint with zero warnings, and TypeScript: passed.
- Vitest component/contract suite: 31 files, 129 tests passed.
- Production build: passed; 27 application routes generated.
- Build and route performance budgets: 12 measurements passed.
- Playwright: 64 passed across Chromium, mobile Chromium, Firefox, and WebKit;
  12 live-data scenarios skipped by the documented environment gate.
- Production dependency audit: 0 vulnerabilities.
- Shared backend contract checks: Ruff format/lint, mypy, compile check, and 6
  pytest tests passed in an isolated Python environment.

## Reliability, privacy, and security

- Root, authenticated-route, and global error boundaries provide safe retry
  copy without rendering exception messages or private data.
- A checked-in 404 recovery page, persistent offline notice, and retry behavior
  cover lost routes and connectivity.
- Operational reporting is off by default. When explicitly configured with a
  same-origin endpoint, only aggregate Web Vitals and sanitized fault counts
  are allowed. Do Not Track and Global Privacy Control are honored. Paths,
  queries, profile answers, document data, tokens, error text/stacks, and AI
  explanations are prohibited and tested.
- No product analytics events were added because none have been approved.
- `npm audit --omit=dev` reports zero production vulnerabilities after narrow
  PostCSS and Sharp overrides. The full development tree reports 11 high
  advisories in the ESLint/OpenAPI toolchain; npm's proposed fixes downgrade
  Next's lint integration or require an ESLint major upgrade, so they were not
  applied without compatibility validation.

## Reference fidelity

The review retained the recorded brief's warm ivory canvas, ink/lavender
contrast, inset sticky navigation, EB Garamond/Figtree hierarchy, oversized
editorial headings, alternating light/dark story rhythm, large HTML/CSS product
demonstrations, proof band, tabs, and lavender closing CTA. The responsive
product mockups remain legible and the mobile hero preserves the intended first
glance.

Deliberate differences remain documented in `REFERENCE_ADAPTATION.md`: all
copy, demonstrations, and icons are ScholarMatch originals; no unverified
partner or outcome claims appear; student stories retain an honest empty state;
and deterministic eligibility remains visually distinct from AI explanation.

## Accepted exceptions and follow-ups

| Exception                                                                                                                                                                                                                                                           | Owner                  | Deadline                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------- |
| Live onboarding, profile, discovery, match, application, upload, and admin E2E scenarios are checked in but gated because the FastAPI domain routes and isolated test tenant/storage are not implemented. Deterministic component/API-mock coverage remains active. | Backend/Auth + QA      | Before staging release    |
| Automated semantic snapshots are not a substitute for a manual VoiceOver/NVDA pass.                                                                                                                                                                                 | Accessibility QA       | Before production release |
| Field Core Web Vitals are unavailable before real traffic; reporting remains disabled until a privacy-approved same-origin collector exists.                                                                                                                        | Web Platform + Privacy | Before public beta        |
| Eleven dev-only audit advisories require coordinated ESLint/Next toolchain validation. Production dependencies are clean.                                                                                                                                           | Frontend Platform      | 5 August 2026             |
