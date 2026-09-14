# Database Blueprint

## Technology
PostgreSQL with Drizzle ORM. Schema source: `lib/db/src/schema/index.ts`. Versioned SQL migrations are stored under `lib/db/drizzle`.

## Core tables
- `school_settings`: school identity, academic year, and currency.
- `school_users`: role-aware accounts and optional linked pupil.
- `school_sessions`: hashed session tokens and expiration.
- `school_login_attempts`: atomic login throttling state.
- `students`: pupil identity, registration number, class, guardian, enrollment, attendance, and fee balances.
- `payments`: receipt, amount, method, reference, date, status, and pupil relationship.
- `attendance`: one status per pupil and date.
- `school_record_sequences`: safe per-school/year registration and receipt counters.

## Operational tables
Expenses, salary payments, announcements, classes, subjects, assignments, staff, parents, guardians, discipline, medical, library, transport, inventory, events, documents, reports, notifications, and timetable records belong to a school. Several currently store flexible JSONB payloads; normalize a domain only through a reviewed migration when its query and integrity needs justify it.

## Relationships and constraints
School-owned records reference `school_settings`. Users may reference a pupil within the same school. Payments and attendance use composite school/pupil foreign keys. Registration numbers and receipts are unique within a school. Payment amounts are positive; fee balances and amount-paid values cannot be negative. Important lookup and expiry columns are indexed.

## Migration and safety rules
- Inspect current rows and constraints before generating migrations.
- Use `pnpm --filter @workspace/db run generate`; review SQL before applying.
- Keep migration output paths relative.
- Never delete or recreate production data to resolve a migration.
- Back up production data before destructive or large transformations.
- Apply additive changes first, backfill safely, then add strict constraints.
- Test fresh migration order and existing-data upgrades.
- Use transactions and row locks for financial balance changes.