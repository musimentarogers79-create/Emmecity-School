---
name: Pupil directory print pagination
description: Prevent blank leading pages and preserve column headings when printing long pupil directories.
---

For long school directories, let the outer panel split across printed pages, keep each record row intact, and format the header as a repeating table-header group. Hide interactive export and filter panels from print output.

**Why:** Applying `break-inside: avoid` to the entire directory panel can push a multi-page list onto a mostly empty next page; interactive controls also add irrelevant print pages and consume space.

**How to apply:** When changing print rules for the pupil directory, keep pagination rules on the panel and row levels distinct, preserve repeating column headings, and verify that controls stay on screen only.