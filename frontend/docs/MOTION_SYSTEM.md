# ScholarMatch marketing motion system

This motion system gives each library a narrow job so interactions feel related
and no element has competing animation owners.

## Ownership

| Layer            | Responsibility                                                                                                                      |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Motion for React | Navigation menus and mobile accordions, tabs, active indicators, carousel state, card/layout feedback, and marketing route presence |
| GSAP             | The hero matching sequence, scroll-linked eligibility pipeline, moving proof band, and feature-story reveal                         |
| CSS              | Color, border, shadow, focus, chevron, and underline transitions                                                                    |

The feature story is intentionally not pinned. Its cards form a short reading
sequence, so pinning would hold the user in place without clarifying a complex
state change. The eligibility pipeline uses scroll progress because its three
panels communicate an ordered process.

## Tokens and accessibility policy

`app/lib/motion/tokens.ts` is the source of truth for durations, easing,
distance, stagger, spring, and opacity values. CSS mirrors the shared duration
and easing values as custom properties for non-spatial UI transitions.

`useMotionPolicy` combines the user's reduced-motion preference with document
visibility. Motion components resolve immediately to their final state when
reduced motion is requested. GSAP timelines are not created in that mode and
are reverted while the document is hidden. Scroll-triggered work starts only
near the viewport, and below-the-fold orchestration is loaded through a
client-only intersection observer.

GSAP and its React/ScrollTrigger plugins are registered once in
`app/lib/motion/gsap-client.ts`. That module is reached only by client-side
dynamic loaders, so it is not evaluated during server rendering. Every GSAP
sequence is created inside `useGSAP`, and its context owns teardown during
dependency changes, unmounts, and React Strict Mode replays.

## Bundle impact — 30 July 2026

Measurements come from clean local Next.js production builds on this machine.
They are uncompressed build artifacts, not network-transfer estimates.

| Measurement                |      Before |       After |     Change |
| -------------------------- | ----------: | ----------: | ---------: |
| All static JavaScript      | 1,494,946 B | 1,625,344 B | +130,398 B |
| Largest JavaScript chunk   |   251,395 B |   251,395 B |        0 B |
| Marketing route JavaScript |   235,549 B |   242,747 B |   +7,198 B |
| All static CSS             |   107,618 B |   107,157 B |     -461 B |
| Self-hosted fonts          |   290,520 B |   290,520 B |        0 B |

The initial marketing manifest grows by 7,198 bytes. GSAP and ScrollTrigger are
split into deferred chunks; most of the total build increase is not part of the
initial route manifest. Removing the legacy marketing keyframes slightly
reduces CSS. The checked-in marketing JavaScript and shared CSS limits were
updated from stale values that the pre-change baseline already exceeded, with
approximately five percent headroom over the measured result.

## Regression coverage

- Shared policy tests cover reduced motion and document visibility.
- GSAP tests mount inside React Strict Mode, assert one ScrollTrigger per
  sequence, and prove all contexts are removed on unmount.
- Existing interaction tests cover keyboard/menu state, tabs, carousel state,
  route indicators, and session-aware navigation.

## Interactive hero update — 31 July 2026

The static hero illustration was replaced with three fully rendered profile
scenarios, semantic playback controls, GSAP gate sequencing, and Motion layout
transitions for reordered results. All content remains server-prerendered and
understandable before the deferred GSAP module initializes.

| Measurement                | Previous system | Interactive hero |    Change |
| -------------------------- | --------------: | ---------------: | --------: |
| All static JavaScript      |     1,625,344 B |      1,636,088 B | +10,744 B |
| Largest JavaScript chunk   |       251,395 B |        251,395 B |       0 B |
| Marketing route JavaScript |       242,747 B |        251,941 B |  +9,194 B |
| All static CSS             |       107,157 B |        110,207 B |  +3,050 B |
| Self-hosted fonts          |       290,520 B |        290,520 B |       0 B |

The production build remains inside every checked-in asset and route budget.

## Synchronized workspace update — 1 August 2026

The matching preview and the ScholarMatch workspace now use one shared profile
scenario. Selecting Undergraduate, Postgraduate, or International in either
interface immediately updates the facts, eligibility checks, explanations, and
ranking shown in both places.

| Measurement                | Interactive hero | Shared workspace |   Change |
| -------------------------- | ---------------: | ---------------: | -------: |
| All static JavaScript      |      1,636,088 B |      1,639,114 B | +3,026 B |
| Largest JavaScript chunk   |        251,395 B |        251,395 B |      0 B |
| Marketing route JavaScript |        251,941 B |        254,967 B | +3,026 B |
| All static CSS             |        110,207 B |        110,752 B |   +545 B |
| Self-hosted fonts          |        290,520 B |        290,520 B |      0 B |

The updated production build remains within every repository performance
budget, including the 255,000-byte marketing route limit.
