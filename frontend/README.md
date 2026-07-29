This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Environment

Copy `.env.example` to `.env.local` and fill it in. Every value is a
`NEXT_PUBLIC_*` variable embedded in the browser bundle — **never** put the
Supabase service-role key (or any server secret) here. The browser only ever
receives the public anon key; authorization is enforced by the backend
verifying the Supabase JWT plus row-level security.

## Authentication & session handling

Auth uses Supabase Auth via `@supabase/ssr`. The session lives in cookies so it
can be refreshed server-side:

- `proxy.ts` (Next.js 16's renamed Middleware) refreshes the session on every
  matched request and applies optimistic redirects. Protected routes preserve
  the intended destination as a sanitized `?next=` path (see
  `app/lib/routing/safe-redirect.ts`).
- `app/auth/confirm/route.ts` completes email verification and password-recovery
  links; `app/auth/signout/route.ts` clears the session.
- Auth screens live under `app/(auth)/`; the resumable onboarding wizard lives
  under `app/(app)/onboarding/`. Onboarding progress is saved to the user's
  Supabase metadata after every completed step, so it resumes on any device,
  with a local mirror for instant/offline resume.

## Typed API contracts

Response and request types are **generated** from the shared contract at
`../docs/openapi.yaml` — do not hand-write them. Regenerate after the contract
changes:

```bash
npm run api:types
```

This writes `app/lib/api/schema.ts` (git-tracked, but excluded from lint and
Prettier as a generated artifact). The typed client in `app/lib/api/client.ts`
consumes those types.

## Quality gate

`npm run quality` runs formatting, lint, type-check, tests, and a production
build — the same checks CI enforces.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load fonts.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
