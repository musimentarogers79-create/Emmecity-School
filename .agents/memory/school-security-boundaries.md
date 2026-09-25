---
name: School security boundaries
description: Non-obvious reasons behind school API request, upload, and notification access rules.
---

Cookie-authenticated mutations must be same-origin; SameSite cookies alone are not a sufficient cross-origin policy.

**Why:** The API previously allowed broad CORS and had no explicit origin check. A sibling origin or a future cookie-policy change could expose school-record mutations.

**How to apply:** New write routes must remain behind the shared same-origin request guard. If third-party API access is needed, design separate token-based authentication rather than reopening cookie-based cross-origin requests.

Photo upload limits must be checked against the received bytes, not caller-declared metadata.

**Why:** A signed direct-upload URL allowed a client to claim a small JPEG and upload a different or oversized body. The old direct-upload route must not be re-enabled without storage-enforced length and content verification.

**How to apply:** Validate actual length and image content before placing pupil photos in private storage, and authorize reads against the linked pupil record.

Legacy announcement notifications lacking an explicit audience should not be shown to non-admin users.

**Why:** Older notifications copied audience-restricted announcement text into a school-wide list without saving the audience as structured metadata.

**How to apply:** Keep those records admin-only unless a reliable backfill can recover the original announcement audience; new notifications should store and check that audience.