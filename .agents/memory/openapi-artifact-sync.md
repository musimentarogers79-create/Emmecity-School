---
name: OpenAPI artifact synchronization
description: Keeps generated React client, Zod validators, and their declaration output aligned after API contract edits.
---

After changing the OpenAPI contract, run the API code generation command and then the workspace library project-reference build before typechecking individual artifacts. If the local Orval binary is unavailable, use the pinned generator version through `pnpm dlx` rather than hand-editing generated output.

**Why:** The workspace can resolve package declarations from generated output that lags behind the freshly generated source, producing misleading type errors even when the contract source is correct.

**How to apply:** Treat generated client/Zod output and library declarations as one change; regenerate first, build library references second, then run server and frontend typechecks.