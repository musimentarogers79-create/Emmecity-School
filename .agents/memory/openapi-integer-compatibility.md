---
name: OpenAPI codegen compatibility
description: Avoid generated Zod helpers unsupported by the workspace's current dependency and generator combination.
---

When adding OpenAPI fields, inspect the generated Zod output before relying on specialized formats. The current generator/dependency combination can emit unsupported helpers for integer and UUID schemas; use number/string schemas and enforce semantic constraints at the API boundary where needed.

**Why:** A valid OpenAPI spec can generate successfully while the chained workspace typecheck fails because generated validation calls helpers unavailable in the installed Zod package.

**How to apply:** Prefer `number` for counts and plain `string` for UUID-like identifiers unless the workspace Zod/generator versions have been upgraded together; rerun API codegen and the library typecheck after contract changes.