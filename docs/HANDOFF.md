# PDF Mana — handoff

_Snapshot for picking this back up later._

## Status

- **Product:** PDF Mana — MV3 Chrome extension, local PDF _page_ manager (Merge · Arrange · Nip · Adjust).
- **Version:** 1.0.18 — packaged at `release/pdf-mana-1.0.18.zip` (older zips in `release/archive/`); tagged + on GitHub Releases.
- **Repo:** https://github.com/billye2/pdfxtn — **public, MIT** (© Billy Ye). `main` is the working branch; release commits carry annotated `vX.Y.Z` tags and `npm run release:publish` creates the GitHub release.
- **Chrome Web Store:** **published / live** at https://chromewebstore.google.com/detail/pdf-mana/bhkhobdaindpenllbgliigfafkkigpnk — **v1.0.16 uploaded 2026-07-06, pending review** (with refreshed listing copy). Once it clears, upload `release/pdf-mana-1.0.18.zip` (contains the a11y fixes + stale-chunk fix; v1.0.17 was never uploaded).
- **Tests:** 140 unit (Vitest; pure logic + persistence via `fake-indexeddb` in Node, hooks via jsdom `// @vitest-environment` docblock), 30 e2e incl. axe a11y scans (Playwright; 1 pointer-drag test skipped) — all in CI — plus 15 visual-regression baselines (`npm run visual`, macOS-local, NOT in CI).
- **Recent work (v1.0.11 → 1.0.18):** "Nighty Night" dark theme (5th Look) with themed
  page-render inversion; crop-box corner-handle resize; WYSIWYG crop previews
  (`lib/cropView.ts`); last-used Look persists in localStorage; dark-theme contrast
  fixes (look menu, restore banner) found by the new axe audit; App.tsx split into
  hooks/components; release automation (tags + GitHub releases); dialogs/lightbox
  un-code-split + pdf-lib warmed at mount so tabs survive extension updates.

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
  - `App.tsx` (wiring), `store.ts` (reducer + undo/redo + `restore`), `themes.ts` (5 Looks + saved-look storage)
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
  light + dark Looks (`e2e/a11y.spec.ts`); real fixes landed in v1.0.17. Two known, deliberate
  gaps: the branded bright buttons sit below 4.5:1 (documented exclusion list in a11y.spec.ts —
  owner's call), and keyboard users can Tab to a card but have no Enter/Space path to *select*
  it (selection is mouse-first; the `←`/`→` nudge works once selected).
- **styles.css split — DONE.** Executed per `docs/styles-split-plan.md`: styles now live in
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
