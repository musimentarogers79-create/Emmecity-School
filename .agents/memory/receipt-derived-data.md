---
name: Receipt-derived data
description: Contract design for school payment and salary receipts
---

Receipt-facing API responses should carry the identifiers and derived balances needed by the browser to render a complete receipt without a second, race-prone lookup.

**Why:** Receipt pages and printable documents need the paid person's identity, receipt number, current balance, and history context immediately after a payment is recorded.

**How to apply:** When adding a new payment type, include its stable account identifier, generated receipt number, and post-payment balance in the response contract; invalidate the related history query after mutation.