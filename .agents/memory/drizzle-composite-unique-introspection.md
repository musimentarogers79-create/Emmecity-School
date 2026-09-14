---
name: Drizzle composite unique introspection
description: Workspace-specific behavior when Drizzle introspects composite PostgreSQL unique constraints.
---

For composite unique constraints, declare columns in the order Drizzle introspects them from the table definition, even when the backing PostgreSQL index was created in a different order.

**Why:** Drizzle Kit 0.31 can report a composite unique constraint in table-column order rather than physical constraint order. A logically equivalent schema declaration with a different order then causes every push to propose recreating the constraint.

**How to apply:** When converting a unique index that supports foreign keys, attach it in place with PostgreSQL's `UNIQUE USING INDEX` form so dependent foreign keys and data remain intact. Introspect afterward and use the reported column order in the Drizzle schema and snapshot.