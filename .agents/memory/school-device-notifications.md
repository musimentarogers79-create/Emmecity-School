---
name: School device notifications
description: Notification delivery boundaries for the school portal across phones and computers.
---

The school portal can persist in-app notification records and show OS-level browser notifications after each device grants permission. Device-level alerts must remain generic and never include announcement titles or bodies; signed-in users can read the full content in the portal. Closed-app delivery is a separate Web Push capability and must use a server-side push service with VAPID credentials stored as Replit Secrets.

**Why:** Shared or locked devices can expose notification text, and browser permission/service-worker support do not by themselves deliver a notification when no portal tab is running; both privacy and reliability need to be explicit.

**How to apply:** Keep announcement, event, and public-holiday records as the source of notification content. When implementing background delivery, add per-device subscriptions, expired-endpoint cleanup, secure VAPID configuration, and cross-platform tests without changing pupil, staff, or guardian records.