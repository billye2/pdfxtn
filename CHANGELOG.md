# Changelog

All notable changes to PDF Mana are documented here. This project follows
[Keep a Changelog](https://keepachangelog.com/) conventions.

Versioning (since 1.2.1): each version component counts 0–9 and carries into
the next, like an odometer — 1.2.9 → 1.3.0 → 1.3.1, … 1.9.9 → 2.0.0. Versions
before 1.2.1 followed semver patch bumps (hence the jump from 1.0.20).

## [1.2.4] — Unreleased

### Added

- **Keyboard page selection** — Tab to a page card and press **Enter** to pick
  or unpick it (the keyboard mirror of Cmd/Ctrl-click); **Shift+Enter** picks a
  range (mirror of Shift-click). Cards show a visible focus ring, and picks are
  announced to screen readers. This closes the last mouse-only step: pick with
  Enter, then preview (Space), nudge (←/→), delete, or duplicate (Cmd/Ctrl+D)
  entirely from the keyboard.
- **Keyboard-shortcuts cheat sheet** — a new keyboard-icon button in the header
  (next to the tips "?") opens a dialog documenting every hotkey, grouped by
  task, with a mouse-gestures footnote. Pressing **?** opens it from anywhere.
- **Action hotkeys** — with pages picked: **R** rotates clockwise (Shift+R
  counter-clockwise), **C** opens Crop, **B** inserts a blank page after,
  **K** keeps only the picked pages, **S** adds split marks. Plain letters
  only — Cmd/Ctrl+R (reload) and Cmd/Ctrl+C (copy) are untouched — and the
  toolbar/dock tooltips now name their keys.

### Changed

- The theme picker no longer shows the four palette dots — on the header
  trigger or in the menu — just the Look names.

## [1.2.3] — 2026-07-10

### Changed

- **Bigger, clearer drop invite.** The empty-state mascot is twice the size
  (144×176), and a persistent dashed drop box now fills ~80% of the area below
  the toolbar, resizing with the window. The dashes match the drag-time
  overlay's style, so dragging a file over reads as the box lighting up. The
  whole box is clickable — click anywhere inside it to open the file picker
  (the mascot stays the keyboard-accessible control).

### Added

- Two help tips covering the new opening screen: drops work anywhere in the
  window (the dashed box doubles as a giant "open a file" button), and greyed
  toolbar buttons reveal what they do on hover before a PDF loads.

## [1.2.2] — 2026-07-10

### Changed

- **The editor opens on the full app chrome.** The toolbar is now always
  visible — page-dependent buttons (Select all, Crop, Split every…, the export
  buttons) start disabled and wake up once pages load — so first-time users can
  see at a glance what PDF Mana does before committing a file. Disabled buttons
  keep their tooltips for feature discovery.
- **Compact drop invite** replaces the full-screen welcome page: a smaller
  mascot (still clickable to pick a file), a one-line "Drop a PDF here — or
  click + Add PDF" hint, and the privacy chip. The big CTA button, long intro
  copy, and floating decor shapes are gone. Drag-and-drop behavior is unchanged
  (the whole window was and remains a drop target).

## [1.2.1] — 2026-07-09

### Added

- **Duplicate pages** — a Duplicate button in the selection dock, plus
  Cmd/Ctrl+D (the shortcut only engages when pages are picked, so browser
  bookmarking still works). Copies land right after their originals, carry
  rotation and crop, and become the new selection.
- **Reverse page order** — a toolbar button that flips the whole document, or
  just the picked pages (within their slots) when two or more are selected.
- **Un-mix** — the inverse of Mix, as a second mode in the Mix dialog: pull an
  interleaved document apart into fronts and backs, with optional
  reverse-second-half and a "Split into two files" mark (on by default) so one
  Save downloads both halves. Mix now opens for single-document sessions and
  starts in Un-mix mode there. One undo reverts the whole operation.
- **Insert blank page** — a Blank page button in the selection dock inserts a
  blank after the last picked page, sized and oriented to match it (a rotated
  landscape neighbor gets a landscape blank). Blanks survive autosave/restore.
- **Tooltips on every toolbar button**, noting keyboard shortcuts where they exist.

### Changed

- Export range… and Export images… are now icon-only toolbar buttons (their
  accessible names are unchanged), keeping the toolbar to a single row.

### Removed

- The **Sunny** look — visually redundant with Blocks. A saved Sunny preference
  (localStorage or a restored session) falls back to Blocks safely.

### Internal

- CI now runs the functional + a11y e2e suite on **Windows** as well as Linux
  (OS matrix on the e2e job).
- New versioning scheme (see header); the release script bumps with 0–9
  carry-over instead of `npm version patch`.

## [1.0.20] — 2026-07-07

### Internal

- CI is green again: ten files that had drifted from prettier style were
  reformatted (the format gate was failing every run), `actions/checkout` and
  `actions/setup-node` were bumped to v5 (Node 24 action runtime, clearing the
  Node 20 deprecation warning), and CI jobs now run on Node 22 LTS.

## [1.0.19] — 2026-07-07

### Internal

- The 1,429-line `styles.css` was relocated verbatim into co-located
  per-component `.css` files plus a shared `styles/base.css` (reset, keyframes,
  button primitives), so each component's styles live next to its code.
  No visual change: the visual-regression suite passes against unchanged
  baselines, and the shipped bundle still emits the same single CSS asset.

## [1.0.18] — 2026-07-07

### Fixed

- An editor tab left open across an extension update (or a dev rebuild) could
  no longer open dialogs or the page preview — "Failed to fetch dynamically
  imported module" — because the update deletes the old build's hashed chunk
  files. Dialogs and the lightbox are now compiled into the main bundle, and
  the PDF export engine is prefetched right after the page opens, so an
  already-open tab keeps working entirely from what it has loaded.

## [1.0.17] — 2026-07-07

### Fixed

- The "Restore your previous work?" banner was unreadable (light-on-light) in
  the Nighty Night theme; it now uses the themed card surface.
- Muted labels in the Blocks theme (header subtitle, status, captions) were
  below the WCAG AA contrast ratio; darkened from 3.2:1 to 5.0:1.
- Screen readers: page cards no longer announce as buttons nested inside a
  button (they're a proper list now), the Split-every/Range/Images inputs have
  labels, and the preview's scroll area is keyboard-focusable.

### Internal

- Accessibility is now audited automatically: axe-core (WCAG 2.1 AA) scans of
  every key screen, in light and dark Looks, run with the e2e suite in CI.
- New theme-matrix visual regression suite (`npm run visual`) screenshots the
  grid, crop dialog, and lightbox in all five Looks against committed
  baselines — the class of bug behind the two dark-theme contrast fixes.
- Releases are now tagged and published to GitHub Releases by
  `npm run release` / `npm run release:publish`.
- `App.tsx` refactored (627 → 286 lines) into focused, unit-tested hooks and
  components; behavior verified pixel-identical by the visual suite.

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
