---
name: Sponsored pupils
description: Financial invariant for pupils whose fees are covered by the school.
---

School sponsorship is an additive pupil-level status. A sponsored pupil must always have zero term fee, previous fee balance, opening payment, and fee balance; registration must not create an opening receipt.

**Why:** Sponsorship is a fee exemption, not a separate pupil type, and existing payment history and pupil records must remain intact.

**How to apply:** Enforce the zero-fee invariant at the API/database boundary, then surface the status in pupil records and every admission document.