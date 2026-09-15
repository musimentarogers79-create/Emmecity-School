---
name: Class access identity
description: Rules for keeping class, stream, teacher, and subject visibility aligned across the school operations API.
---

Teacher class assignments must use one canonical class-and-stream identity everywhere. The UI, assignment mutation, derived teacher access, attendance filters, timetable filters, and subject visibility must all compare the same normalized value; nullable persisted subject teacher IDs must also be represented as nullable in the API contract.

**Why:** A UI-only separator format caused assignments to appear saved while never linking the class to the teacher, and unassigned subjects exposed a nullability mismatch that turned the subjects endpoint into a 500 response.

**How to apply:** When changing class or subject access, update the canonical key handling and every reader of teacher assignments together, then regenerate the OpenAPI clients and exercise both assigned and unassigned subject paths.