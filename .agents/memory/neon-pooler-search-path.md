---
name: Neon pooler search path
description: Neon pooler connections in this workspace may start with an empty PostgreSQL search_path.
---

When the app uses the Neon pooler connection string, configure each newly opened node-postgres client with `SET search_path TO public`; startup `options=-c search_path=public` is rejected by the Neon pooler.

**Why:** The copied public tables existed and row counts matched, but unqualified Drizzle queries failed until the session search path was set.

**How to apply:** Keep the application tables in PostgreSQL's public schema and apply the per-connection setup only when the Neon connection is active. Do not expose or log the connection string.