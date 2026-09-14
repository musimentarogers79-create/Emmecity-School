---
name: School schema audit
description: The school database keeps its existing domain tables and uses additive integrity checks and indexes for routine schema hardening.
---

Keep the current domain tables as the source of truth for their respective records. Prefer additive validation, scoped indexes, and duplicate protection over merging or deleting tables unless the user explicitly requests a data migration.

**Why:** The application intentionally separates canonical pupils and login accounts from operation records, and broad schema reconciliation could alter existing school data.

**How to apply:** When hardening this schema, inspect live values first, add only non-destructive constraints or indexes, generate the Drizzle migration, apply the reviewed development delta, and verify the live constraints afterward.