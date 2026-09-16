---
name: Production authentication bootstrap
description: Production login depends on a separately populated database and bootstrap administrator.
---

The deployed school API may use a production database that does not contain development staff accounts. The first production administrator must be bootstrapped from the configured password secret, and the canonical administrator identifier is `Isingoma`.

**Why:** Publishing code does not automatically copy development user records into production, so a login flow can appear healthy locally while every expected production username returns 401. A duplicate legacy administrator should not remain as a second login.

**How to apply:** Keep production bootstrap idempotent, preserve existing administrator credentials when renaming the legacy account, and delete a duplicate `admin` row whenever `Isingoma` already exists.