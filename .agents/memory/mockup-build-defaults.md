---
name: Mockup build defaults
description: Build-time environment behavior for the mockup sandbox Vite configuration.
---

The mockup sandbox Vite config should default `PORT` and `BASE_PATH` for static workspace builds, while honoring workflow-provided values when the preview server runs.

**Why:** The workspace root build invokes every artifact without workflow environment variables. Requiring `PORT` or `BASE_PATH` unconditionally makes an otherwise healthy monorepo build fail before the application artifacts are checked.

**How to apply:** Keep strict validation for explicitly provided invalid values, but use a local development port and `/` base path when those variables are absent during a regular build.