---
name: Administrator account removal
description: The school runtime no longer creates a default administrator login.
---

The administrator role remains available for role-based authorization, but the canonical default administrator account is intentionally absent and must not be recreated during startup.

**Why:** The owner explicitly removed the default account; silently recreating it would undo the deletion and leave an unexpected login path.

**How to apply:** Keep role checks and non-default staff accounts working, but do not add bootstrap credentials, canonical identifiers, or startup password requirements for a deleted default account.