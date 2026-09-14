---
name: Development schema drift
description: How to handle a development database whose existing constraints make a normal Drizzle push interactive.
---

When development schema push is blocked by an unrelated legacy constraint prompt, do not use a broad force push just to apply an additive feature change. Apply only the reviewed additive DDL through the approved development database flow, and keep the generated migration as the schema source of truth.

**Why:** A force reconciliation can alter or truncate existing records while solving an unrelated drift problem.

**How to apply:** Inspect the exact requested schema delta, apply only that delta in development, and leave broader drift for the dedicated database-drift task or post-merge setup.