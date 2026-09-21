---
name: Replit production versus Neon migration
description: The managed Replit production database can diverge from the development database copied into Neon.
---

Treat Replit development and managed production as separate data sources during migrations. Export and verify production records before switching the application to Neon; the development connection and its backup may contain only a partial or older dataset.

**Why:** The development database can contain a small test dataset while the separately managed production database holds the live school records. Copying `DATABASE_URL` alone is not proof that production data was migrated.

**How to apply:** Before a production-to-Neon cutover, make a destination backup, read production through the read-only production database channel, transfer the complete related table set transactionally, restart the API to clear cached school context, and compare aggregate counts and stable identifiers afterward.