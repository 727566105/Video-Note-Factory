# Change: Add PWA support and comfortable theme modes

## Why
VideoNote should feel installable and app-like on desktop/mobile, and users need a comfortable dark mode that can follow the system preference without using harsh pure black surfaces.

## What Changes
- Add PWA manifest, icons, and a lightweight service worker registration for installability and static asset caching.
- Add light, dark, and system theme modes.
- Use a deep gray dark palette centered around `#2D2D2D` instead of full black.
- Expose theme selection from settings or another persistent app control.

## Impact
- Affected specs: app-shell
- Affected code: `videoNote_frontend/index.html`, `videoNote_frontend/public/*`, `videoNote_frontend/src/main.tsx`, `videoNote_frontend/src/index.css`, settings UI/theme utilities.
