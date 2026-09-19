---
name: Production authentication bootstrap
description: Production login depends on a separately populated database and bootstrap administrator.
---

The deployed school API may use a production database that does not contain development staff accounts. The first production administrator must be bootstrapped from the configured password secret, and the canonical administrator identifier is `Isingoma`.

**Why:** Publishing code does not automatically copy development user records into production, so a login flow can appear healthy locally while every expected production username returns 401. A duplicate legacy administrator should not remain as a second login.

**How to apply:** Keep bootstrap idempotent, preserve an existing Isingoma password unless the user explicitly changes it, keep the canonical administrator name/identifier fixed, and delete only a duplicate legacy `admin` row when Isingoma already exists.