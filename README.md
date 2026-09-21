# EMMECTY School Management System

A secure, responsive management platform for EMMECTY NURSERY & PRIMARY SCHOOL, with role-specific tools for administrators, teachers, accountants, guardians, pupils, and staff.

## Technology
React, Vite, TypeScript, Express, PostgreSQL, Drizzle ORM, OpenAPI, Orval, Zod, and TanStack Query in a pnpm workspace.

## Run
1. Configure the variables listed in `.env.example` through Replit Secrets/environment settings.
2. Install dependencies with `pnpm install`.
3. Start the configured frontend and API workflows, or run:
   - `pnpm --filter @workspace/school-ops run dev`
   - `pnpm --filter @workspace/api-server run dev`

## Check
- `pnpm run typecheck`
- `pnpm run build`
- `git diff --check`

## API and database changes
Edit `lib/api-spec/openapi.yaml`, run API codegen, then update callers. Generate and review Drizzle migrations for database changes. Never recreate the existing database or use development schema push against production.

## Required environment
See `.env.example`. Production must provide a strong `SCHOOL_BOOTSTRAP_PASSWORD`.

## Structure
- `artifacts/school-ops` — web frontend.
- `artifacts/api-server` — Express API.
- `lib/api-spec` — OpenAPI contract.
- `lib/api-client-react` and `lib/api-zod` — generated clients and validators.
- `lib/db` — PostgreSQL schema and migrations.
- `docs` — project blueprints.

## Deployment
Build and typecheck first, configure production secrets, apply reviewed migrations, then publish the registered web and API services through Replit.# EMMECTY School Management System

A secure, responsive management platform for EMMECTY NURSERY & PRIMARY SCHOOL, with role-specific tools for administrators, teachers, accountants, guardians, pupils, and staff.

## Technology
React, Vite, TypeScript, Express, PostgreSQL, Drizzle ORM, OpenAPI, Orval, Zod, and TanStack Query in a pnpm workspace.

## Run
1. Configure the variables listed in `.env.example` through Replit Secrets/environment settings.
2. Install dependencies with `pnpm install`.
3. Start the configured frontend and API workflows, or run:
   - `pnpm --filter @workspace/school-ops run dev`
   - `pnpm --filter @workspace/api-server run dev`

## Check
- `pnpm run typecheck`
- `pnpm run build`
- `git diff --check`

## API and database changes
Edit `lib/api-spec/openapi.yaml`, run API codegen, then update callers. Generate and review Drizzle migrations for database changes. Never recreate the existing database or use development schema push against production.

## Required environment
See `.env.example`. Production must provide a strong `SCHOOL_BOOTSTRAP_PASSWORD`.

## Structure
- `artifacts/school-ops` — web frontend.
- `artifacts/api-server` — Express API.
- `lib/api-spec` — OpenAPI contract.
- `lib/api-client-react` and `lib/api-zod` — generated clients and validators.
- `lib/db` — PostgreSQL schema and migrations.
- `docs` — project blueprints.

## Deployment
Build and typecheck first, configure production secrets, apply reviewed migrations, then publish the registered web and API services through Replit.