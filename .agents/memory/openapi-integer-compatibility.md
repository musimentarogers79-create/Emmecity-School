---
name: OpenAPI integer compatibility
description: Compatibility note for OpenAPI code generation and the workspace's current Zod dependency.
---

When adding OpenAPI response fields in this workspace, verify the generated Zod output before relying on `integer` schemas. The current catalog Zod version may not expose the generator's `zod.int()` helper, so integer fields can break library typechecking after codegen.

**Why:** A valid OpenAPI spec can generate successfully while the chained workspace typecheck fails on the generated validation code.

**How to apply:** Prefer `number` for counts and rankings unless the workspace Zod/generator versions have been upgraded together; always rerun the API codegen command and library typecheck after spec changes.