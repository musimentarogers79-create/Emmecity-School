# Project Coding Instructions

## Project
EMMECTY NURSERY & PRIMARY SCHOOL management system, branded with Corenexa Systems identity.

## Commands
- `pnpm run typecheck` — check libraries and artifacts.
- `pnpm run build` — typecheck and build.
- `pnpm --filter @workspace/school-ops run dev` — frontend.
- `pnpm --filter @workspace/api-server run dev` — API.
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API clients.
- `pnpm --filter @workspace/db run generate` — create a reviewed migration.
- `pnpm --filter @workspace/db run push` — development schema sync only.

## Conventions
Use TypeScript, existing formatting, focused components, Wouter routes, generated API hooks, stable test IDs, and visible “Pupil/Pupils” wording. Keep internal API identifiers stable unless deliberately migrating them.

## UI/UX
Use responsive layouts, keyboard-visible focus, accessible labels, meaningful loading/error/empty states, and Corenexa branding. The school name must remain prominent. Avoid page-wide render observers, animation loops, and expensive effects that can freeze low-powered devices.

## API and database
Change OpenAPI first, run codegen, then update implementations. Enforce roles server-side. Use transactions for enrollment, payments, and sequential numbers. Never store raw passwords or session tokens. Use versioned, non-destructive migrations and preserve tenant constraints.

## Testing and deployment
Typecheck affected packages, run `git diff --check`, restart changed workflows once, inspect logs, and verify the changed user flow. Production requires `DATABASE_URL`, `SESSION_SECRET`, `PORT`, and `SCHOOL_BOOTSTRAP_PASSWORD`.

## Warnings
Do not recreate the database, use production schema push, expose secrets, hardcode Replit development URLs in browser code, or hand-edit generated API files.# Project Coding Instructions

## Project
EMMECTY NURSERY & PRIMARY SCHOOL management system, branded with Corenexa Systems identity.

## Commands
- `pnpm run typecheck` — check libraries and artifacts.
- `pnpm run build` — typecheck and build.
- `pnpm --filter @workspace/school-ops run dev` — frontend.
- `pnpm --filter @workspace/api-server run dev` — API.
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API clients.
- `pnpm --filter @workspace/db run generate` — create a reviewed migration.
- `pnpm --filter @workspace/db run push` — development schema sync only.

## Conventions
Use TypeScript, existing formatting, focused components, Wouter routes, generated API hooks, stable test IDs, and visible “Pupil/Pupils” wording. Keep internal API identifiers stable unless deliberately migrating them.

## UI/UX
Use responsive layouts, keyboard-visible focus, accessible labels, meaningful loading/error/empty states, and Corenexa branding. The school name must remain prominent. Avoid page-wide render observers, animation loops, and expensive effects that can freeze low-powered devices.

## API and database
Change OpenAPI first, run codegen, then update implementations. Enforce roles server-side. Use transactions for enrollment, payments, and sequential numbers. Never store raw passwords or session tokens. Use versioned, non-destructive migrations and preserve tenant constraints.

## Testing and deployment
Typecheck affected packages, run `git diff --check`, restart changed workflows once, inspect logs, and verify the changed user flow. Production requires `DATABASE_URL`, `SESSION_SECRET`, `PORT`, and `SCHOOL_BOOTSTRAP_PASSWORD`.

## Warnings
Do not recreate the database, use production schema push, expose secrets, hardcode Replit development URLs in browser code, or hand-edit generated API files.