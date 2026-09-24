---
name: Payment balance recalculation
description: The invariant used when an existing fee transaction is edited.
---

Pupil fee totals must be rebuilt from the saved completed payment rows after a transaction edit, not adjusted by applying a delta to the current balance.

**Why:** Repeated edits otherwise accumulate rounding and update-order drift, leaving pupil balances and finance summaries inconsistent with the payment ledger.

**How to apply:** Recalculate amount paid and the non-negative outstanding balance inside the same database transaction that saves a payment edit; sponsored pupils still resolve to zero payable fees.

An increase to a completed payment must not push the completed-payment total above the pupil's payable fees unless the product explicitly supports credit balances. Permit corrections that reduce an already-overpaid legacy total.

**Why:** Clamping an overpaid balance to zero hides money received beyond the fee obligation; blocking downward corrections would make old mistakes harder to repair.

**How to apply:** Check the aggregate under the pupil lock before committing an increased payment, and leave a correction that reduces a pre-existing overpayment available.