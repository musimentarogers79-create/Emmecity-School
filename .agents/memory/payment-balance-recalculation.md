---
name: Payment balance recalculation
description: The invariant used when an existing fee transaction is edited.
---

Pupil fee totals must be rebuilt from the saved completed payment rows after a transaction edit, not adjusted by applying a delta to the current balance.

**Why:** Repeated edits otherwise accumulate rounding and update-order drift, leaving pupil balances and finance summaries inconsistent with the payment ledger.

**How to apply:** Recalculate amount paid and the non-negative outstanding balance inside the same database transaction that saves a payment edit; sponsored pupils still resolve to zero payable fees.