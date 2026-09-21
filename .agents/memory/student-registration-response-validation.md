---
name: Student registration response validation
description: Admission response enums must omit unset parent-status fields rather than return empty strings.
---

When building an admission response, optional enum fields such as parent status must be omitted when unset, not populated with `""`. The API validates the response after the database transaction, so a validation failure can report an error even though the pupil was already saved.

**Why:** The registration endpoint previously committed the pupil and admission form, then rejected its own response because empty parent-status strings were outside the `alive | deceased` enum. Users retried and created duplicate pupils.

**How to apply:** Represent unset enum fields as `undefined`/omitted JSON properties, keep response validation after the fix, and treat any post-transaction response error as a high-risk duplicate-creation path.