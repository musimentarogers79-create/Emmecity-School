# Essential Architecture

## Stack and services
- Frontend: React, Vite, TypeScript, Tailwind CSS, Wouter, TanStack Query.
- API: Express 5 and TypeScript, bundled with esbuild.
- Data: PostgreSQL with Drizzle ORM and versioned migrations.
- Contract: OpenAPI is the source of truth; Orval generates React Query hooks and Zod validators.

## Structure
- `artifacts/school-ops`: browser application.
- `artifacts/api-server`: API and authorization layer.
- `lib/api-spec`: OpenAPI contract.
- `lib/api-client-react` and `lib/api-zod`: generated clients and validation.
- `lib/db`: schema, connection, and migrations.

## Data and authentication
Schools own users, pupils, payments, attendance, sequences, and operation records. Composite school/pupil constraints prevent cross-school references. Passwords are hashed. Browser cookies carry random session tokens; PostgreSQL stores only token hashes and expirations. Server routes enforce role and record-level access.

## API and coding rules
Define contract changes in OpenAPI, regenerate clients, then update server and frontend callers. Use generated hooks in the frontend. Keep server-owned identity and timestamps on the server. Preserve route and identifier compatibility unless a migration is approved.

## Responsive rules
Support 320px and larger widths, keyboard focus, readable contrast, touch-sized controls, safe loading/empty/error states, and no hook calls below conditional returns. Avoid render loops, unbounded observers, and expensive decorative effects.

## Safe database changes
Never recreate the current database. Add schema changes through reviewed Drizzle migrations, preserve existing rows, add constraints only after checking current data, and test transaction/concurrency behavior for financial or numbering changes. Do not use destructive push operations in production.

## Avoid
In-memory mutable production data, raw SQL assembled from user input, plaintext passwords or session tokens, hardcoded production URLs, duplicated API types, unbounded polling, and silent fallbacks that hide persistence errors.# Essential Architecture

## Stack and services
- Frontend: React, Vite, TypeScript, Tailwind CSS, Wouter, TanStack Query.
- API: Express 5 and TypeScript, bundled with esbuild.
- Data: PostgreSQL with Drizzle ORM and versioned migrations.
- Contract: OpenAPI is the source of truth; Orval generates React Query hooks and Zod validators.

## Structure
- `artifacts/school-ops`: browser application.
- `artifacts/api-server`: API and authorization layer.
- `lib/api-spec`: OpenAPI contract.
- `lib/api-client-react` and `lib/api-zod`: generated clients and validation.
- `lib/db`: schema, connection, and migrations.

## Data and authentication
Schools own users, pupils, payments, attendance, sequences, and operation records. Composite school/pupil constraints prevent cross-school references. Passwords are hashed. Browser cookies carry random session tokens; PostgreSQL stores only token hashes and expirations. Server routes enforce role and record-level access.

## API and coding rules
Define contract changes in OpenAPI, regenerate clients, then update server and frontend callers. Use generated hooks in the frontend. Keep server-owned identity and timestamps on the server. Preserve route and identifier compatibility unless a migration is approved.

## Responsive rules
Support 320px and larger widths, keyboard focus, readable contrast, touch-sized controls, safe loading/empty/error states, and no hook calls below conditional returns. Avoid render loops, unbounded observers, and expensive decorative effects.

## Safe database changes
Never recreate the current database. Add schema changes through reviewed Drizzle migrations, preserve existing rows, add constraints only after checking current data, and test transaction/concurrency behavior for financial or numbering changes. Do not use destructive push operations in production.

## Avoid
In-memory mutable production data, raw SQL assembled from user input, plaintext passwords or session tokens, hardcoded production URLs, duplicated API types, unbounded polling, and silent fallbacks that hide persistence errors.# Essential Architecture

## Stack and services
- Frontend: React, Vite, TypeScript, Tailwind CSS, Wouter, TanStack Query.
- API: Express 5 and TypeScript, bundled with esbuild.
- Data: PostgreSQL with Drizzle ORM and versioned migrations.
- Contract: OpenAPI is the source of truth; Orval generates React Query hooks and Zod validators.

## Structure
- `artifacts/school-ops`: browser application.
- `artifacts/api-server`: API and authorization layer.
- `lib/api-spec`: OpenAPI contract.
- `lib/api-client-react` and `lib/api-zod`: generated clients and validation.
- `lib/db`: schema, connection, and migrations.

## Data and authentication
Schools own users, pupils, payments, attendance, sequences, and operation records. Composite school/pupil constraints prevent cross-school references. Passwords are hashed. Browser cookies carry random session tokens; PostgreSQL stores only token hashes and expirations. Server routes enforce role and record-level access.

## API and coding rules
Define contract changes in OpenAPI, regenerate clients, then update server and frontend callers. Use generated hooks in the frontend. Keep server-owned identity and timestamps on the server. Preserve route and identifier compatibility unless a migration is approved.

## Responsive rules
Support 320px and larger widths, keyboard focus, readable contrast, touch-sized controls, safe loading/empty/error states, and no hook calls below conditional returns. Avoid render loops, unbounded observers, and expensive decorative effects.

## Safe database changes
Never recreate the current database. Add schema changes through reviewed Drizzle migrations, preserve existing rows, add constraints only after checking current data, and test transaction/concurrency behavior for financial or numbering changes. Do not use destructive push operations in production.

## Avoid
In-memory mutable production data, raw SQL assembled from user input, plaintext passwords or session tokens, hardcoded production URLs, duplicated API types, unbounded polling, and silent fallbacks that hide persistence errors.# Essential Architecture

## Stack and services
- Frontend: React, Vite, TypeScript, Tailwind CSS, Wouter, TanStack Query.
- API: Express 5 and TypeScript, bundled with esbuild.
- Data: PostgreSQL with Drizzle ORM and versioned migrations.
- Contract: OpenAPI is the source of truth; Orval generates React Query hooks and Zod validators.

## Structure
- `artifacts/school-ops`: browser application.
- `artifacts/api-server`: API and authorization layer.
- `lib/api-spec`: OpenAPI contract.
- `lib/api-client-react` and `lib/api-zod`: generated clients and validation.
- `lib/db`: schema, connection, and migrations.

## Data and authentication
Schools own users, pupils, payments, attendance, sequences, and operation records. Composite school/pupil constraints prevent cross-school references. Passwords are hashed. Browser cookies carry random session tokens; PostgreSQL stores only token hashes and expirations. Server routes enforce role and record-level access.

## API and coding rules
Define contract changes in OpenAPI, regenerate clients, then update server and frontend callers. Use generated hooks in the frontend. Keep server-owned identity and timestamps on the server. Preserve route and identifier compatibility unless a migration is approved.

## Responsive rules
Support 320px and larger widths, keyboard focus, readable contrast, touch-sized controls, safe loading/empty/error states, and no hook calls below conditional returns. Avoid render loops, unbounded observers, and expensive decorative effects.

## Safe database changes
Never recreate the current database. Add schema changes through reviewed Drizzle migrations, preserve existing rows, add constraints only after checking current data, and test transaction/concurrency behavior for financial or numbering changes. Do not use destructive push operations in production.

## Avoid
In-memory mutable production data, raw SQL assembled from user input, plaintext passwords or session tokens, hardcoded production URLs, duplicated API types, unbounded polling, and silent fallbacks that hide persistence errors.# Essential Architecture

## Stack and services
- Frontend: React, Vite, TypeScript, Tailwind CSS, Wouter, TanStack Query.
- API: Express 5 and TypeScript, bundled with esbuild.
- Data: PostgreSQL with Drizzle ORM and versioned migrations.
- Contract: OpenAPI is the source of truth; Orval generates React Query hooks and Zod validators.

## Structure
- `artifacts/school-ops`: browser application.
- `artifacts/api-server`: API and authorization layer.
- `lib/api-spec`: OpenAPI contract.
- `lib/api-client-react` and `lib/api-zod`: generated clients and validation.
- `lib/db`: schema, connection, and migrations.

## Data and authentication
Schools own users, pupils, payments, attendance, sequences, and operation records. Composite school/pupil constraints prevent cross-school references. Passwords are hashed. Browser cookies carry random session tokens; PostgreSQL stores only token hashes and expirations. Server routes enforce role and record-level access.

## API and coding rules
Define contract changes in OpenAPI, regenerate clients, then update server and frontend callers. Use generated hooks in the frontend. Keep server-owned identity and timestamps on the server. Preserve route and identifier compatibility unless a migration is approved.

## Responsive rules
Support 320px and larger widths, keyboard focus, readable contrast, touch-sized controls, safe loading/empty/error states, and no hook calls below conditional returns. Avoid render loops, unbounded observers, and expensive decorative effects.

## Safe database changes
Never recreate the current database. Add schema changes through reviewed Drizzle migrations, preserve existing rows, add constraints only after checking current data, and test transaction/concurrency behavior for financial or numbering changes. Do not use destructive push operations in production.

## Avoid
In-memory mutable production data, raw SQL assembled from user input, plaintext passwords or session tokens, hardcoded production URLs, duplicated API types, unbounded polling, and silent fallbacks that hide persistence errors.# Essential Architecture

## Stack and services
- Frontend: React, Vite, TypeScript, Tailwind CSS, Wouter, TanStack Query.
- API: Express 5 and TypeScript, bundled with esbuild.
- Data: PostgreSQL with Drizzle ORM and versioned migrations.
- Contract: OpenAPI is the source of truth; Orval generates React Query hooks and Zod validators.

## Structure
- `artifacts/school-ops`: browser application.
- `artifacts/api-server`: API and authorization layer.
- `lib/api-spec`: OpenAPI contract.
- `lib/api-client-react` and `lib/api-zod`: generated clients and validation.
- `lib/db`: schema, connection, and migrations.

## Data and authentication
Schools own users, pupils, payments, attendance, sequences, and operation records. Composite school/pupil constraints prevent cross-school references. Passwords are hashed. Browser cookies carry random session tokens; PostgreSQL stores only token hashes and expirations. Server routes enforce role and record-level access.

## API and coding rules
Define contract changes in OpenAPI, regenerate clients, then update server and frontend callers. Use generated hooks in the frontend. Keep server-owned identity and timestamps on the server. Preserve route and identifier compatibility unless a migration is approved.

## Responsive rules
Support 320px and larger widths, keyboard focus, readable contrast, touch-sized controls, safe loading/empty/error states, and no hook calls below conditional returns. Avoid render loops, unbounded observers, and expensive decorative effects.

## Safe database changes
Never recreate the current database. Add schema changes through reviewed Drizzle migrations, preserve existing rows, add constraints only after checking current data, and test transaction/concurrency behavior for financial or numbering changes. Do not use destructive push operations in production.

## Avoid
In-memory mutable production data, raw SQL assembled from user input, plaintext passwords or session tokens, hardcoded production URLs, duplicated API types, unbounded polling, and silent fallbacks that hide persistence errors.