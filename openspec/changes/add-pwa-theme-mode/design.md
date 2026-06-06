## Context
The frontend already has CSS custom properties and a `.dark` variant, but no user-facing theme mode selection. The app also ships public images that can be reused for PWA icons.

## Goals
- Provide browser install prompts and app metadata through a web manifest.
- Cache the app shell/static assets without interfering with API data freshness.
- Support `light`, `dark`, and `system` theme preferences.
- Keep dark mode comfortable: deep gray surfaces, visible borders, and no pure-black base surfaces.

## Non-Goals
- Offline note editing or offline API data access.
- Push notifications.
- Reworking every individual page layout.

## Decisions
- Use a hand-written manifest and service worker to avoid adding a PWA build dependency.
- Store the explicit theme choice in local storage and resolve `system` through `prefers-color-scheme`.
- Apply the `dark` class on `document.documentElement` so existing Tailwind dark variants keep working.
- Keep service worker caching focused on static navigation/assets and bypass `/api/*`.

## Risks / Trade-offs
- Stale assets: mitigate by versioned cache name and safe network-first navigation fallback.
- Inconsistent dark styling in older hard-coded colors: mitigate through global CSS variables and targeted settings/control surfaces first.
