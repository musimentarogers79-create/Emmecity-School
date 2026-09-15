---
name: User-management removal boundary
description: The boundary to preserve when removing administrator account-management screens and APIs.
---

Remove administrator account creation, editing, permissions, and directory access without deleting or disabling existing accounts.

**Why:** Authentication, class assignment, and salary workflows still depend on the existing staff records even when administrators no longer manage accounts in this product surface.

**How to apply:** Keep sign-in, current-user profile behavior, and internal staff lookups available; remove only the administrator CRUD routes, management UI, and generated contract operations.