# PDF Mana — handoff

_Snapshot for picking this back up later._

## Status

- **Product:** PDF Mana — MV3 Chrome extension, local PDF _page_ manager (Merge · Arrange · Nip · Adjust).
- **Version:** 1.2.4 — packaged at `release/pdf-mana-1.2.4.zip` (older zips in `release/archive/`). **Versioning is odometer-style since 1.2.1**: each component counts 0–9 and carries (1.2.9 → 1.3.0 → … → 1.9.9 → 2.0.0); `npm run release` implements the carry. GitHub Releases exist through v1.0.18; the v1.0.19 through v1.2.4 tags are pushed but their GitHub releases await `npm run release:publish` (agent sessions can't run it — it creates a public release).
- **Repo:** https://github.com/billye2/pdfxtn — **public, MIT** (© Billy Ye). `main` is the working branch; release commits carry annotated `vX.Y.Z` tags and `npm run release:publish` creates the GitHub release.
- **Chrome Web Store:** **published / live** at https://chromewebstore.google.com/detail/pdf-mana/bhkhobdaindpenllbgliigfafkkigpnk — **v1.2.1 cleared review and is live (2026-07-10); v1.2.3 submitted for review 2026-07-10**; **v1.2.4 (the keyboard pack) is packaged and ready to upload once 1.2.3 clears**. v1.2.2 was never uploaded (superseded). Promo video is on YouTube: https://www.youtube.com/watch?v=-0Jnd0kRKog (goes in the dashboard's "Promotional video" field). Both local videos in `release/video/` were re-recorded against v1.2.4 (2026-07-11) — the YouTube upload is the older 1.2.3 cut, so replace/re-upload it (and optionally upload the v2 page-tools cut) when convenient.
- **Tests:** 173 unit (Vitest; pure logic + persistence via `fake-indexeddb` in Node, hooks via jsdom `// @vitest-environment` docblock), 35 e2e incl. axe a11y scans (Playwright; 1 pointer-drag test skipped) — in CI on **Linux + Windows** — plus 12 visual-regression baselines (`npm run visual`, macOS-local, NOT in CI).
- **Recent work (v1.0.11 → 1.0.20):** "Nighty Night" dark theme with themed
  page-render inversion; crop-box corner-handle resize; WYSIWYG crop previews
  (`lib/cropView.ts`); last-used Look persists in localStorage; dark-theme contrast
  fixes (look menu, restore banner) found by the new axe audit; App.tsx split into
  hooks/components; release automation (tags + GitHub releases); dialogs/lightbox
  un-code-split + pdf-lib warmed at mount so tabs survive extension updates;
  styles.css relocated into co-located per-component files + `styles/base.css`
  (v1.0.19); CI hygiene — prettier gate satisfied, actions@v5, Node 22 (v1.0.20).
- **Recent work (v1.2.1):** arrangement pack — Duplicate (dock + Cmd/Ctrl+D),
  Reverse (all or picked), Un-mix mode inside the Mix dialog (Mix now opens for
  single-doc sessions), Insert blank page (neighbor-sized, rotation-aware,
  synthetic pdf-lib doc through the normal ingest pipeline); toolbar tooltips
  everywhere + icon-only export buttons (single-row toolbar); Sunny look removed
  (falls back to Blocks, including stale saved sessions); Windows e2e CI job.
- **Recent work (v1.2.2):** toolbar-first opening screen — the toolbar renders
  in every app state (new `hasPages` prop gates Select all / Crop / Split
  every… / exports; the rest were already selection- or count-guarded) so the
  button row doubles as a capability map for new users; `EmptyState` slimmed to
  a compact drop invite (smaller mascot, "Drop a PDF here — or click + Add
  PDF" h1, privacy chip; CTA/body copy/decor removed). Visual baselines
  unchanged (the suite never shot the empty state); e2e empty-state marker text
  updated in `e2e/helpers.ts` + `extension.spec.ts`.
- **Recent work (v1.2.3):** empty state v2 — mascot doubled to 144×176; a
  persistent dashed drop box (matching `DragOverlay`'s `4px dashed var(--c-add)`
  style) fills 80%×80% of `.main` (min-height 340px floor) and resizes with the
  window; the whole box opens the picker on click (single handler on
  `.drop-zone`, mascot button's click bubbles — no double-fire; note `pickFiles`
  clicks a _detached_ input, so tests must patch
  `HTMLInputElement.prototype.click` to observe it). Two new HELP_TIPS cover
  drop-anywhere and hover-to-discover disabled toolbar buttons.
- **Recent work (v1.2.4): the keyboard pack.** Enter/Shift+Enter pick pages from
  the keyboard (cards carry `data-page-id`, get a `:focus-visible` ring, picks
  announce via the aria-live region); action hotkeys R/Shift+R, C, B, K, S act
  on the picked pages (guarded: no Cmd/Ctrl, not typing, inert while a modal is
  open — that guard now covers the WHOLE global map, fixing a leak where
  arrows/Space/Delete edited pages behind dialogs); keyboard crop (stage takes
  the crop dialog's initial focus; arrows place/move the box, Shift+arrows
  resize, live-region announcements); a shortcuts cheat-sheet dialog
  (`ShortcutsDialog.tsx`, header keyboard-icon button + the `?` key); theme
  picker palette dots removed (`paletteDots` deleted). Crop + header visual
  baselines regenerated along the way.

## Commands

```bash
npm install
npm run dev        # Vite dev server (HMR)
npm run build      # tsc + vite build → dist/
npm test           # unit tests (Vitest)
npm run e2e        # end-to-end + a11y scans (Playwright, loads built dist/)
npm run visual     # theme-matrix screenshot regression (macOS-local baselines;
                   #   visual:update regenerates e2e/__screenshots__/ after
                   #   intentional UI changes or a Playwright/Chromium bump)
npm run lint       # ESLint (lint:fix to auto-fix)
npm run format     # Prettier write (format:check to verify)
npm run release    # cut a release: bump + build + zip + "Release vX" commit + tag vX
npm run release:publish   # push main + tag, create the GitHub release with the zip
npm run icons      # regenerate icons from src/icons/icon.svg
node scripts/screenshots.mjs   # store screenshots (1280x800) → release/screenshots/
node scripts/promo.mjs         # promo tiles (440x280, 1400x560) → release/promo/
node scripts/promo-video.mjs   # promo video (webm) → release/video/ (upload via YouTube)
node scripts/promo-video-2.mjs # promo video v2 — page-tools cut (rotate/crop/duplicate/
                               #   blank/delete/keep-these via the dock) → release/video/
node scripts/demo-gif.mjs      # 15s README demo → release/video/readme-demo.webm;
                               #   ffmpeg commands in the script header → docs/demo.gif
```

> ⚠️ Always repackage with **`npm run release`** so the zip version increments — the Web
> Store rejects re-uploads at an existing version. Never hand-zip `dist/` at the same version.
> `npm run release` requires a `## [next-version]` CHANGELOG.md section up front and refuses
> to run off `main`; use `npm run release -- --zip-only` for a git-less repackage.

## Load / test locally

1. `npm run build`
2. `chrome://extensions` → Developer mode → **Load unpacked** → select `dist/`.
3. For `file://` PDFs: extension **Details** → enable "Allow access to file URLs".
4. Context menu only shows on **`.pdf` links / PDF pages** (right-click a `.pdf` hyperlink to see "Open link in PDF Mana"). Reload the _extension_ (not the browser) after code changes.

## Repo map

- `src/manifest.ts` — MV3 manifest (perms: activeTab, storage, contextMenus + optional host).
- `src/background.ts` — service worker: icon click, context menus, tab→editor handoff.
- `src/editor/` — the app:
  - `App.tsx` (wiring), `store.ts` (reducer + undo/redo + `restore`), `themes.ts` (4 Looks + saved-look storage)
  - `components/` — Header, Toolbar, ThumbnailGrid, PageThumb, PagePeek, Lightbox, CropDialog,
    RangeDialog, ImagesDialog, MixDialog, SplitEveryDialog, SelectionDock, EmptyState, …
  - `hooks/` — `useToast`, `useDialogs`, `useExport`, `useAutosave`, `usePeek`
  - `lib/` — `pageModel.ts` (descriptor ops), `ingest.ts`, `pdfRender.ts`, `pdfExport.ts`,
    `pdfImages.ts` (download or fflate `.zip`), `persist.ts` (IndexedDB autosave), `pageRange.ts`
- `e2e/` — Playwright suite. `scripts/` — release, icons, screenshots, promo.
- `docs/STORE_LISTING.md` — listing copy + per-permission justifications + checklist.
- `docs/privacy-practices-copy.md` — paste-ready justification blocks for the dashboard.
- `PRIVACY.md` — privacy policy (also the policy URL on GitHub).

## To publish an update

The item is already live. To ship a new version:

1. Run `npm run visual` (screenshot regression) if UI changed. Write the
   `## [next-version]` CHANGELOG.md section, then `npm run release`
   (commit + tag) and `npm run release:publish` (push + GitHub release).
2. Open the item in https://chrome.google.com/webstore/devconsole →
   **Package** → upload a new version → `release/pdf-mana-<version>.zip`.
3. Refresh listing copy from `docs/STORE_LISTING.md` if it changed. Optionally set **Homepage URL** → `https://github.com/billye2/pdfxtn` for a clickable source link.
4. **Remote code → No.** Data collected → **None** (certify the 3 boxes). Privacy policy URL → the PRIVACY.md GitHub link.
5. Refresh screenshots (`release/screenshots/`), optional promo tiles (`release/promo/`).
6. Submit for review.

## Known gaps / next steps (none blocking)

- **Persistence — DONE.** IndexedDB autosave + "Restore previous work?" banner (`lib/persist.ts`,
  `hooks/useAutosave.ts`, store `restore`). Still single-session/local only — no cross-device sync
  or named projects.
- **Accessibility — audited.** axe-core (WCAG 2.1 AA) scans run in CI over the key screens in
  light + dark Looks (`e2e/a11y.spec.ts`); real fixes landed in v1.0.17. One known, deliberate
  gap remains: the branded bright buttons sit below 4.5:1 (documented exclusion list in
  a11y.spec.ts — owner's call). The former keyboard-selection gap is **closed in v1.2.4**:
  Enter picks/unpicks the focused card, Shift+Enter range-picks (handled centrally in
  `useKeyboardShortcuts` via the card's `data-page-id`; cards have a `:focus-visible` ring
  and picks announce via the aria-live region). Note there is NO dnd-kit KeyboardSensor —
  the grid registers only PointerSensor; keyboard reorder is the `←`/`→` nudge.
- **styles.css split — DONE.** (Plan doc removed after execution; see git history if
  the rationale is needed — `docs/styles-split-plan.md` at 3813e88.) Styles now live in
  `src/editor/styles/base.css` (reset, keyframes, button base/variants, app shell, the
  midnight-invert cross-component rule; imported by `main.tsx`) plus co-located
  `components/<Name>.css` files imported by their owning component. Verbatim moves, no
  renames — verified by the visual suite passing without baseline regeneration, full
  unit + e2e suites, and an exact 215 = 215 rule-block count against the original file.
- **Scale/perf** — source docs still stay in memory; image export can now bundle to one `.zip`
  (`opts.zip`) instead of N downloads. Still worth profiling a 500-page / 100 MB PDF (render is
  lazy via IntersectionObserver, but parse + bytes are held in full).
- **Context menu discoverability** — scoped to `.pdf` links/pages by design; could broaden if desired.
- **Bundle trim** — fonts ship both `.woff` and `.woff2` + `latin-ext`; dropping the legacy/
  unused ones saves ~480 KB (only matters for store size).
- **e2e** — drag-reorder isn't automatable (dnd-kit + synthetic events); covered by unit tests.

## Gotchas

- Test files are excluded from the app `tsc` build (`tsconfig.app.json`) because one imports
  `node:fs`. Don't pipe `npm run build` to /dev/null — a hidden tsc failure stops `dist/`
  from regenerating and you'll unknowingly test stale code.
- pdf-lib export copies pages **batched per source doc** (one `copyPages` call) — copying
  one page at a time duplicates shared fonts/images and explodes file size (~Nx). Keep it batched.
