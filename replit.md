# SchoolOps

SchoolOps is a role-aware primary school operations platform for administrators, teachers, accountants, guardians, and pupils.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

### Demo accounts

Use the SchoolOps sign-in page with these development accounts:

- Administrator: `admin` / `admin123`
- Teacher: `teacher` / `teach123`
- Accountant: `accountant` / `account123`
- Pupil: `STU-2026-0001` / `pupil123`
- Guardian: `GUARDIAN-001` / `parent123`

The first build uses seeded server-side demo data for the core flows. Persistent PostgreSQL storage, the remaining school modules, and production-grade account hardening are planned follow-ups.

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
- `artifacts/api-server/src/lib/school-data.ts` — demo users, students, attendance, finance, announcements, and timetable data
- `lib/api-spec/openapi.yaml` — source-of-truth API contract
- `artifacts/school-ops/src/pages/school-pages.tsx` — app pages and core workflows
- `artifacts/school-ops/src/index.css` — SchoolOps visual theme

## Architecture decisions

- The permanent pupil-facing identifier is a generated registration number such as `STU-2026-0001`; it is separate from the internal student record id.
- Login accepts staff usernames and pupil/guardian registration identifiers through the same role-aware entry point.
- API contracts are defined in OpenAPI first and generated into the shared React client and Zod validation package.
- Core first-build workflows use server-side seeded demo data so the UI can be exercised before the persistence layer is expanded.

## Product

The first build includes role-aware sign-in, dashboard summaries, student directory and registration, student profiles, attendance entry, fee summaries and payment recording, announcements, timetable views, and report-card viewing.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
