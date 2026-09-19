---
name: Payroll ledger
description: Payroll payments use a normalized school-scoped ledger while legacy salary records remain readable.
---

New salary payments belong in the normalized payroll ledger and must validate the staff member, period balance, receipt sequence, and positive amount inside one transaction. Existing generic salary records remain part of the read path so historical payments are not silently lost.

**Why:** Generic JSONB salary records could not provide reliable period-level overpayment protection or database-enforced receipt uniqueness, while the school already had salary history that must remain visible.

**How to apply:** Keep payroll writes transactional and period-scoped; use the globally unique staff account ID as the foreign-key target because this workspace’s Drizzle introspection cannot safely add a composite school/account unique constraint to the populated account table.