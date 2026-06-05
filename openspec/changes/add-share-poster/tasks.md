# Share Poster - Tasks

## 1. Implementation
- [x] 1.1 Create a reusable `SharePosterDialog` component with preview, style selector, loading/error states, and action footer.
- [x] 1.2 Define a configurable poster style preset library for B 站、小红书、YouTube、X、微信公众号、专业简约等风格, including palette, background, badges, icon elements, content density, and layout metadata.
- [x] 1.3 Build poster HTML/CSS renderer using task title, author, platform, cover image, selected note content, share time, and QR code.
- [x] 1.4 Generate the poster image with existing `html2canvas` flow, handling cross-origin cover fallback.
- [x] 1.5 Add actions for saving poster PNG, invoking Web Share API when available, and copying the share link.
- [x] 1.6 Add the share entry to the note detail toolbar without crowding existing copy/export/delete actions.

## 2. Verification
- [x] 2.1 Run `pnpm build` in `videoNote_frontend`.
- [x] 2.2 Verify `/notes/:id` opens the share dialog and each style renders a nonblank poster.
- [x] 2.3 Verify save image, copy link, and system share fallback behavior.
- [x] 2.4 Check desktop widths around 1280px and 1685px for no toolbar overlap.
