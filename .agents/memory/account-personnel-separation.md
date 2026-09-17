---
name: Account and personnel separation
description: Defines the boundary between login accounts and operational pupil or staff records.
---

Login accounts are access credentials, not personnel records. Creating or deleting an account must not automatically create or delete a pupil, teacher, nurse, guardian, or staff-directory record. An account edit may synchronize a personnel record only when that record is already explicitly linked.

**Why:** Account setup and cleanup must not change school registers, staffing lists, pupil counts, medical records, or other operational data.

**How to apply:** Keep account CRUD isolated from operational-record CRUD. Use inactive, unlinked account placeholders when a role slot is needed before a real person is assigned.