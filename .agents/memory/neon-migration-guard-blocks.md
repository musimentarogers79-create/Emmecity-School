---
name: Neon migration guard blocks
description: Neon MCP's prepared migration path may reject PostgreSQL DO blocks in Drizzle migration bundles.
---

Neon MCP migration preparation can fail with an unterminated dollar-quoted string when a bundled Drizzle migration contains `DO $$ ... $$;` preflight guards. Do not remove these guards by default. First inspect what each protects and verify its condition against the actual target; only omit a guard from the prepared SQL when the condition is proven vacuous, then test the remaining schema change on Neon’s temporary branch and clearly disclose the omission. Keep the source migration unchanged.

**Why:** The MCP preparation path may not preserve dollar-quoted procedural blocks even though PostgreSQL itself supports them. Skipping a non-vacuous guard could bypass migration safety checks.

**How to apply:** Query target schema/data read-only, confirm the exact migration target, prepare and verify on a temporary branch, and require the user’s confirmation before applying the prepared migration to its parent.