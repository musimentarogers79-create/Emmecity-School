# SchoolOps

SchoolOps is a role-aware primary school operations platform for administrators, teachers, accountants, guardians, and pupils.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

### Bootstrap account

The development workspace starts with only the bootstrap administrator account. No staff,
pupil, guardian, finance, attendance, or operational records are seeded. The administrator
creates all other accounts from Operations → People & accounts.

Pupil and guardian accounts must be linked to a pupil record. Pupil identifiers are permanent
registration numbers; staff accounts use usernames. Passwords are hashed before storage.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/school-ops` — responsive SchoolOps web app
- `artifacts/api-server/src/routes/school.ts` — core school API routes
- `artifacts/api-server/src/lib/school-data.ts` — bootstrap account, school settings, and runtime school records
- `lib/api-spec/openapi.yaml` — source-of-truth API contract
- `artifacts/school-ops/src/pages/school-pages.tsx` — app pages and core workflows
- `artifacts/school-ops/src/index.css` — SchoolOps visual theme

## Architecture decisions

- The permanent pupil-facing identifier is a generated registration number such as `STU-2026-0001`; it is separate from the internal student record id.
- Login accepts staff usernames and pupil/guardian registration identifiers through the same role-aware entry point.
- API contracts are defined in OpenAPI first and generated into the shared React client and Zod validation package.
- The current runtime starts clean apart from the bootstrap administrator and default UGX school settings; records are created through role-authorized API actions.

## Product

The first build includes role-aware sign-in, dashboard summaries, student directory and registration, student profiles, attendance entry, fee summaries and payment recording, announcements, timetable views, and report-card viewing.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
