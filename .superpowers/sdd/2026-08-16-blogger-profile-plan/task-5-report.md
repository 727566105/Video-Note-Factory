# Task 5 Test Report

Date: 2026-08-16
Baseline: `11116e2 fix: cover trajectory empty-state stats`

## Automated Verification

- Backend targeted: `cd backend && ../.venv/bin/python -m pytest tests/test_collection_profile_summary.py -q`
  - PASS: 9 passed
  - Warning: `pkg_resources` deprecation warning from `zhconv` dependency.
- Backend full suite: `cd backend && ../.venv/bin/python -m pytest tests/ -q`
  - PASS: 418 passed
  - Warnings: 9 total, including the `zhconv` `pkg_resources` warning and MCP client's `streamable_http_client` deprecation warning.
- Frontend Vitest: `cd videoNote_frontend && pnpm test -- --run`
  - PASS: 5 test files, 29 tests passed.
  - Warning: pnpm reports the deprecated/ignored `pnpm.allowBuilds` package.json field; Node reports `module.register()` deprecation.
- Frontend TypeScript: `cd videoNote_frontend && npx tsc --noEmit`
  - PASS: exit code 0.
- Frontend production build: `cd videoNote_frontend && pnpm build`
  - PASS: Vite build completed successfully.
  - Warnings: stale Browserslist data, `lottie-web` uses `eval`, request.ts dynamic import is also statically imported, and several chunks exceed 1000 kB.
- Repository checks: `git diff --check`
  - PASS: no whitespace errors.

## Browser Verification

Local services were reachable:

- Frontend: `http://127.0.0.1:3015` returned HTTP 200.
- Backend docs: `http://127.0.0.1:8483/docs` returned HTTP 200.

Using `ego-browser`, the app opened successfully but redirected to `/login` and displayed the login form. No authenticated session was available, and no credentials were provided for this verification run. Therefore these flows were not truthfully executable:

- Open trajectory collection and record current stats/stale banner.
- Append several tasks in the unified edit dialog and verify realtime stats/timeline refresh.
- Confirm the existing report remains labeled as generated from the old item count.
- Click `重新总结` and inspect that the request uses `mode: "trajectory"`, then verify replacement report count.
- Verify resize behavior after refresh.
- Verify legacy trajectory summary headings and non-trajectory modes (overview, comparison, timeline, mindmap).

No browser-discovered defect was identified, and no code or test fix was made.

## Working Tree / Commit

The requested baseline commit remains unchanged. The only pre-existing untracked file observed is:

- `videoNote_frontend/public/timeline-preview.html`

It was not modified, staged, or committed because it is outside this verification task's reviewed files.

No verification-adjustment commit was created.

## Concerns

1. Authenticated browser verification remains outstanding and should be rerun with a valid local account/session.
2. Existing non-blocking dependency/build warnings are recorded above; they did not fail tests, typecheck, or build.
3. The production bundle contains large chunks, including chunks above 3 MB before gzip; this is a pre-existing performance concern and was not refactored under this task.

## Review Fix Report

### Changes

- `generate_collection_summary` now records `len(items)` in `item_count_at_generation`, while prompt numbering, batch summarization, and profile statistics continue to use only available markdown material.
- Added backend regression coverage where the complete collection item count differs from the available material count.
- `SummarySettings` now hides the custom tab for `variant="collection"` and resets a stale custom `activeTab` to the default view when the variant changes.
- Added frontend coverage for collection-only tabs and stale custom-tab state.
- Left the unrelated untracked `videoNote_frontend/public/timeline-preview.html` untouched.

### Verification

- `cd backend && ../.venv/bin/python -m pytest tests/test_collection_profile_summary.py -q` — PASS: 10 passed.
- `cd backend && ../.venv/bin/python -m pytest tests/ -q` — PASS: 419 passed, 9 warnings.
- `cd videoNote_frontend && pnpm test -- --run` — PASS: 6 files, 31 tests.
- `cd videoNote_frontend && npx tsc --noEmit` — PASS.
- `git diff --check` — PASS.

### Concerns

- Existing dependency/runtime deprecation warnings remain (`pkg_resources`, MCP client API, Node `module.register`, and pnpm config warning); no failures.
- Authenticated browser verification remains unavailable because no credentials/session were provided.
