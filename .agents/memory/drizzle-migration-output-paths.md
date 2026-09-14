---
name: Drizzle migration output paths
description: Workspace-specific Drizzle migration path and composite-foreign-key generation behavior.
---

Configure Drizzle Kit’s migration `out` directory as a package-relative path, not an absolute path built from `__dirname`.

**Why:** An absolute output path can generate the first migration successfully, then later snapshot discovery prefixes it with `./` and fails with a duplicated path such as `.//home/...`.

**How to apply:** Use a relative value such as `./drizzle`. When adding a composite foreign key to an existing PostgreSQL table, ensure its supporting unique constraint exists before the foreign key is applied.