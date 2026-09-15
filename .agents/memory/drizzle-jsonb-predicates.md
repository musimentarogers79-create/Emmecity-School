---
name: Drizzle JSONB predicates
description: A runtime safety rule for JSONB document lookups written with Drizzle SQL templates.
---

When a Drizzle `sql` template compares a JSONB text value to a literal, include both opening and closing quotes inside the template. A missing closing quote can compile successfully but causes every surrounding write transaction to fail when the predicate is evaluated.

**Why:** A pupil edit path returned a generic conflict because its admission-document lookup contained an unterminated SQL string; the failure was only visible in the database error log.

**How to apply:** Inspect generated SQL for JSONB predicates whenever a database-backed update returns a generic conflict, especially when the update also reads or synchronizes a document record.