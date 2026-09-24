---
name: Payment permission boundary
description: Authority to view school finance versus record or correct fee payments.
---

Finance viewing is read-only. Recording and correcting pupil payments require payment-management permission, except for administrators and accountants who manage payments by role.

**Why:** The formerly view-labelled finance grant also allowed payment writes, so someone expected to inspect totals could change receipts and balances.

**How to apply:** Keep server authorization and visible payment actions aligned. A payment-management grant should also allow reading the payment list and summary, without automatically granting access to unrelated finance areas such as salary records.