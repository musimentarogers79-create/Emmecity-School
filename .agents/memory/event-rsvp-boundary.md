---
name: Event RSVP boundary
description: Scope boundary between local browser reminders and authoritative school event attendance.
---

Browser reminders and calendar exports are device-specific conveniences. They should not be treated as authoritative attendance records. RSVP responses that administrators need to count, limit, or review must be persisted against the signed-in account and event.

**Why:** The first Events release needed useful RSVP and reminder behavior without introducing a new data model, but local storage cannot synchronize responses across devices or provide a trustworthy attendee list.

**How to apply:** Keep reminder permission and reminder timing local to the device. When server-side RSVP work is implemented, add account-scoped event responses, enforce attendee limits on the API, and keep existing events readable during the transition.