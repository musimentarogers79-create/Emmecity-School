---
name: Admission parent records
description: Parent and guardian details are stored as part of the admission document and printed as an official register.
---

Admission parent information is additive document data: preserve the existing guardian fields, store mother and father identity, life status, contacts, and other details in the saved admission form, and render the same values in the printable document.

**Why:** The admission document already owns registration-only information, so extending that payload avoids a risky migration of the core pupil table while keeping old admission records readable.

**How to apply:** Keep parent fields optional for historical records, preserve blank status when unknown, and use a compact multi-column table for printed parent details so the form remains readable on A4 paper.