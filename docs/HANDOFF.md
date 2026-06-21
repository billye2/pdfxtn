# PDF Mana — handoff

_Snapshot for picking this back up later._

## Status

- **Product:** PDF Mana — MV3 Chrome extension, local PDF *page* manager (Merge · Arrange · Nip · Adjust).
- **Version:** 1.0.4 — packaged at `release/pdf-mana-1.0.4.zip`.
- **Repo:** https://github.com/billye2/pdfxtn — **public, MIT** (© Billy Ye). `main` is the working branch; everything is committed and pushed.
- **Chrome Web Store:** fully prepared but **not yet published** by the user. The only remaining work is the dashboard submission (register, upload zip, paste copy, submit).
- **Tests:** 46 unit (Vitest) + 12 e2e (Playwright; 11 run, 1 drag test skipped) — all green.
- **Last change (v1.0.4):** fixed an MV3 service-worker race in `src/background.ts` that
  surfaced as "Unchecked runtime.lastError: Cannot create item with duplicate id open-pdf-link".
  `removeAll()` is async, so `onInstalled` + `onStartup` racing could both reach `create()`;
  `create()` now takes a callback that reads `runtime.lastError`, making the duplicate benign.

## Commands

```bash
npm install
npm run dev        # Vite dev server (HMR)
npm run build      # tsc + vite build → dist/
npm test           # unit tests (Vitest)
npm run e2e        # end-to-end (Playwright, loads built dist/)
npm run release    # BUMP patch version + build + zip → release/pdf-mana-<version>.zip
npm run icons      # regenerate icons from src/icons/icon.svg
node scripts/screenshots.mjs   # store screenshots (1280x800) → release/screenshots/
node scripts/promo.mjs         # promo tiles (440x280, 1400x560) → release/promo/
```

> ⚠️ Always repackage with **`npm run release`** so the zip version increments — the Web
> Store rejects re-uploads at an existing version. Never hand-zip `dist/` at the same version.

## Load / test locally

1. `npm run build`
2. `chrome://extensions` → Developer mode → **Load unpacked** → select `dist/`.
3. For `file://` PDFs: extension **Details** → enable "Allow access to file URLs".
4. Context menu only shows on **`.pdf` links / PDF pages** (right-click a `.pdf` hyperlink to see "Open link in PDF Mana"). Reload the *extension* (not the browser) after code changes.

## Repo map

- `src/manifest.ts` — MV3 manifest (perms: activeTab, storage, contextMenus + optional host).
- `src/background.ts` — service worker: icon click, context menus, tab→editor handoff.
- `src/editor/` — the app:
  - `App.tsx` (wiring), `store.ts` (reducer + undo/redo), `themes.ts` (4 Looks)
  - `components/` — Header, Toolbar, ThumbnailGrid, PageThumb, Lightbox, CropDialog,
    RangeDialog, ImagesDialog, MixDialog, SplitEveryDialog, SelectionDock, EmptyState, …
  - `lib/` — `pageModel.ts` (descriptor ops), `ingest.ts`, `pdfRender.ts`, `pdfExport.ts`,
    `pdfImages.ts`, `pageRange.ts`
- `e2e/` — Playwright suite. `scripts/` — release, icons, screenshots, promo.
- `docs/STORE_LISTING.md` — listing copy + per-permission justifications + checklist.
- `docs/privacy-practices-copy.md` — paste-ready justification blocks for the dashboard.
- `PRIVACY.md` — privacy policy (also the policy URL on GitHub).

## To submit (user-only steps)

1. Register at https://chrome.google.com/webstore/devconsole (one-time $5).
2. Create item → upload `release/pdf-mana-1.0.4.zip`.
3. Paste listing fields from `docs/STORE_LISTING.md`; justifications from `docs/privacy-practices-copy.md`.
4. **Remote code → No.** Data collected → **None** (certify the 3 boxes). Privacy policy URL → the PRIVACY.md GitHub link.
5. Upload icon (128) + screenshots (`release/screenshots/`), optional promo tiles (`release/promo/`).
6. Submit for review.

## Known gaps / next steps (none blocking)

- **No persistence** — reload loses work (only a `beforeunload` warning). Planned-but-deferred:
  IndexedDB autosave + a "Restore previous work?" banner.
- **Scale/perf** — untested on very large PDFs; source docs stay in memory; image export is
  sequential downloads (a zip option would be nicer).
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
