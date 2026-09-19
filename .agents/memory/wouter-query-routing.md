---
name: Wouter query routing
description: Query-string handling for the school operations routes.
---

Operations view selection must read `window.location.search` when running in the browser. The pathname returned by the router hook can omit the query string, which makes routes such as `/operations?view=events` silently fall back to the first operations view.

**Why:** A route-level Events implementation was present but the preview continued rendering the older Operations hub because the query parameter was not being read from the router value.

**How to apply:** Keep pathname checks for the route itself, but parse query parameters from the browser URL search string and verify deep links directly in preview after routing changes.