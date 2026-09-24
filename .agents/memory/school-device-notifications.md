---
name: School notifications
description: Delivery, privacy, and SMS cost boundaries for school notifications.
---

The school portal can persist in-app notification records and show OS-level browser notifications after each device grants permission. Device-level alerts must remain generic and never include announcement titles or bodies; signed-in users can read the full content in the portal. Closed-app delivery is a separate Web Push capability and must use a server-side push service with VAPID credentials stored as Replit Secrets. SMS and email delivery must remain disabled unless the corresponding provider and channel are explicitly configured. SMS copy must fit one segment: at most 160 GSM-7 septets, or 70 UTF-16 code units when Unicode encoding is needed; never silently split a message into billable segments.

**Why:** Shared or locked devices can expose notification text, browser permission/service-worker support do not by themselves deliver a notification when no portal tab is running, and multi-segment SMS can increase charges.

**How to apply:** Keep announcement, event, and public-holiday records as the source of notification content. The school portal has no global Notifications button or service-worker notification center; event reminders are handled only from the event flow. Before adding a paid outbound channel, require explicit provider/channel configuration, validate the final SMS payload against GSM-7/UCS-2 segment limits, and test without sending live messages. If background delivery is reintroduced, add per-device subscriptions, expired-endpoint cleanup, secure VAPID configuration, and cross-platform tests without changing pupil, staff, or guardian records.