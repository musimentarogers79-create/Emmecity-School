---
name: Payment permission boundary
description: Authority to view school finance versus record or correct fee payments.
---

Finance viewing is read-only. Recording and correcting pupil payments require payment-management permission, except for administrators and accountants who manage payments by role. A payment-management grant may read pupil identity and the term charge details needed to attach a receipt, but it does not grant access to unrelated finance data such as salary records.

**Why:** The formerly view-labelled finance grant also allowed payment writes, so someone expected to inspect totals could change receipts and balances.

**How to apply:** Keep server authorization and visible payment actions aligned. Term-ledger payments must carry an explicit charge ID and idempotency key; expose only the pupil and charge lookups needed to complete that authorized payment.