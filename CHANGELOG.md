# Changelog

All notable changes to PDF Mana are documented here. This project follows
[Keep a Changelog](https://keepachangelog.com/) conventions and
[Semantic Versioning](https://semver.org/).

## [1.0.16] — 2026-07-06

### Added

- The selected Look (theme) is now remembered across sessions — reopening the
  editor comes back in your last-used theme, with or without a document loaded
  and without needing the Restore banner.

### Fixed

- Look picker menu labels were black-on-dark (unreadable) in the Nighty Night
  theme; they now follow each theme's ink color.
- "Discard" on the restore banner now waits for the saved session to actually
  be cleared before dismissing, so the restore offer can no longer reappear if
  the tab is reloaded or closed immediately after discarding (also fixed a
  flaky CI e2e failure caused by the same race).

## [1.0.15] — 2026-07-06

### Changed

- Page thumbnails and the long-press peek now show cropped pages **as they will
  export** — tightly framed to the crop region — instead of the full page with a
  dimmed overlay. A small badge marks cropped pages (the crop stays
  non-destructive; "Clear crop" still undoes it), and cropped thumbnails render
  at higher resolution so the tighter framing stays sharp. The lightbox keeps
  the full-page view with the crop highlighted, for context when re-cropping.
- Reopening the Crop dialog on an already-cropped document starts from the
  existing crop box instead of an empty stage.

### Docs

- Added a scripted promo-video recorder (`scripts/promo-video.mjs`) and Web
  Store listing instructions for the promotional video field.

## [1.0.14] — 2026-07-01

### Added

- New **"Nighty Night"** dark theme (a fifth selectable Look). Rendered PDF pages
  are inverted so white pages don't glare on the dark UI, and the empty-state
  mascot adapts to the theme surface.
- The crop box can now be resized by dragging any of its four corner handles —
  the opposite corner stays anchored — instead of redrawing from scratch.

## [1.0.13] — 2026-06-24

### Docs

- Documented text/content editing (and OCR, forms, annotations) as a permanent
  non-goal in a new README "Scope" section.

## [1.0.12] — 2026-06-24

### Changed

- Crop preview now scales to fit the viewport (up to `min(620px, 90vw)` wide or
  72% of window height) instead of a fixed 240px box, and renders at higher
  resolution so the larger canvas stays sharp.

## [1.0.11] — 2026-06-23

### Fixed

- Fixed a latent e2e regression.

### Tests

- Added coverage for persistence, keyboard reordering, and zip export.

## [1.0.10] — 2026-06-23

### Changed

- Reorder pages with arrow keys, replacing the spacebar grab-mode.
- In the preview lightbox, Space now toggles it closed (Esc still works).
- Refreshed help tips for autosave and zip export.

## [1.0.9] — 2026-06-23

### Added

- Autosave to IndexedDB with a restore banner to recover your session after
  closing and reopening.
- Optional single `.zip` bundle when exporting pages as images.
- Keyboard page reordering with screen-reader announcements.

### Changed

- Refactored the editor: extracted `useToast`, `useDialogs`, `useExport`, and
  `usePeek` hooks (with tests).

## [1.0.8] — 2026-06-23

### Changed

- Widened the preview lightbox with scrolling and swapped the preview icon.

### Removed

- Disabled mouse-hover page peek (long-press peek retained).

## [1.0.7] — 2026-06-23

### Added

- Hover / long-press page peek with wheel scrolling.

## [1.0.6] — 2026-06-22

### Changed

- Lazy-load `pdf-lib` and extracted a shared `SegmentedControl`.

### Fixed

- Hardened core: UUID page ids, crop clamping, store tests.

### Internal

- Added CI, ESLint/Prettier, and an accessibility pass.

## [1.0.5] — 2026-06-21

### Changed

- Moved the Mix / Split-every group next to the Export range control.

## [1.0.4] — 2026-06-20

### Fixed

- Fixed a duplicate-id error in context-menu registration.

## [1.0.3] — 2026-06-20

### Internal

- Added a release script that bumps the version on every repackage.

## [1.0.2] — 2026-06-20

### Changed

- Made host access optional and user-initiated.
- Removed the redundant `tabs` permission.
- Polished the Chrome Web Store listing copy and privacy notes.

## [1.0.0] — 2026-06-20

Initial Chrome Web Store release of **PDF Mana** (Merge · Arrange · Nip ·
Adjust).

### Added

- Merge, reorder, rotate, crop, and split PDF pages.
- Mix / interleave pages, split-every-N, and Images ↔ PDF conversion.
- Page-preview lightbox and lazy-loaded thumbnails.
- Image export with per-page scope.
- "Open in PDF Mana" page context-menu entry.
- Warn-before-unload when work is in progress; Save progress UI.
- Full-feature Playwright e2e suite.

[1.0.13]: https://github.com/billye2/pdfxtn/releases/tag/v1.0.13
[1.0.12]: https://github.com/billye2/pdfxtn/releases/tag/v1.0.12
[1.0.11]: https://github.com/billye2/pdfxtn/releases/tag/v1.0.11
[1.0.10]: https://github.com/billye2/pdfxtn/releases/tag/v1.0.10
[1.0.9]: https://github.com/billye2/pdfxtn/releases/tag/v1.0.9
[1.0.8]: https://github.com/billye2/pdfxtn/releases/tag/v1.0.8
[1.0.7]: https://github.com/billye2/pdfxtn/releases/tag/v1.0.7
[1.0.6]: https://github.com/billye2/pdfxtn/releases/tag/v1.0.6
[1.0.5]: https://github.com/billye2/pdfxtn/releases/tag/v1.0.5
[1.0.4]: https://github.com/billye2/pdfxtn/releases/tag/v1.0.4
[1.0.3]: https://github.com/billye2/pdfxtn/releases/tag/v1.0.3
[1.0.2]: https://github.com/billye2/pdfxtn/releases/tag/v1.0.2
[1.0.0]: https://github.com/billye2/pdfxtn/releases/tag/v1.0.0
