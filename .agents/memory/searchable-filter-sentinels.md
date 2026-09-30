---
name: Searchable filter sentinels
description: Keep filter “all” values consistent when replacing native selects with searchable pickers.
---

When replacing a filter select with a searchable picker, preserve the existing “All classes” sentinel as an explicit option rather than mapping it to an empty value.

**Why:** Existing filters compare against the sentinel string; clearing to an empty value can unexpectedly filter out every row.

**How to apply:** Check the filter’s initial state and predicate before changing its control. Keep the same value contract, including its “all” option.