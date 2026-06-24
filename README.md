# PDF Mana

**M**erge · **A**rrange · **N**ip · **A**djust

A Chrome extension (Manifest V3) for managing PDF pages — entirely in your browser.
Nothing is uploaded; all parsing and writing happens locally.

## Features

- **Reorder** pages — drag a whole card anywhere to move it, or keyboard-reorder
  (focus a card, Space to pick up, arrow keys to move, Space to drop)
- **Delete / extract** — remove pages, or "Keep these" to extract only the selected ones
- **Rotate** pages (per page or across a selection)
- **Merge** — add multiple PDFs and they append into one document
- **Mix / interleave** — combine documents alternately; one-click preset for
  double-sided scans done on a single-sided feeder
- **Split** — mark boundaries by hand, or **Split every N pages**; export one file per part
- **Crop** — draw one region and apply it to all or just the selected pages
- **Images → PDF** — drop JPG/PNG files in and they become pages
- **PDF → Images** — export pages as PNG/JPG at 1×–3× (all / selected / custom range),
  optionally bundled into a single `.zip`
- **Export by position** — save an arbitrary page range (`1-3, 5, 8-10`)
- **Page preview** — double-click a page (or the magnifier / Space) for a large view with
  arrow-key paging and inline rotate / crop / delete; the view fills the width and you
  scroll the wheel to read down a tall page
- **Peek** — on a touch screen, press and hold a page for a quick enlarged look (handy for
  confirming the right page before reordering on a small display)
- **Page labels stay original** — a page keeps its source page number after reordering
- **Four themes** — switchable "Looks" (Blocks, Bubble, Sticker, Sunny)
- **Undo / redo** (Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z), select-all, Esc to clear
- **Autosave & restore** — your session is saved locally (IndexedDB) as you work, so an
  accidental reload offers a one-click "Restore your previous work?"
- **Save progress** indicator, and a warning before you reload away unsaved work
- Load from a **local file** (picker or drag-drop), the **PDF open in the current tab**, or
  a **right-click** on any PDF link → "Open link in PDF Mana"

## Develop

```bash
npm install
npm run dev      # Vite dev server with HMR
npm run build    # production build → dist/
npm test         # unit tests (Vitest)
npm run e2e      # end-to-end tests (Playwright; loads the built extension)
npm run lint     # ESLint (use `npm run lint:fix` to auto-fix)
npm run format   # Prettier write (use `npm run format:check` to verify)
npm run icons    # regenerate icons from src/icons/icon.svg
```

Lint, format, unit tests, build, and the e2e suite all run in CI on every push and
pull request (`.github/workflows/ci.yml`).

> If `npm install` warns about skipped install scripts, run
> `npm approve-scripts esbuild` once (esbuild needs its native binary).

## Load in Chrome

1. `npm run build`
2. Go to `chrome://extensions`, enable **Developer mode** (top right).
3. Click **Load unpacked** and select the `dist/` folder.
4. **To edit PDFs opened from your file system** (`file://…`), click **Details** on the
   extension card and enable **"Allow access to file URLs"**.

## Usage

- Click the toolbar icon to open the editor in a new tab (a PDF open in the active tab
  loads automatically), use **+ Add PDF**, or drag files into the window.
- Select pages (click; Cmd/Ctrl-click to multi-select; Shift-click for a range), then use
  the toolbar / selection dock to rotate, crop, split, extract, or delete.
- Click **Save PDF** to download `‹name›-edited.pdf`. With split marks set it downloads one
  file per part (`‹name›-part1.pdf`, …). **Export range…** and **Export images…** offer
  more targeted output.
- The header **?** cycles through usage tips; the **Look** picker switches themes.

## How it works

The editor's state is an ordered list of **page descriptors**
(`{ docId, pageIndex, rotation, crop }`) — not raw PDF bytes. Every operation is a
pure transform over that list, which keeps edits non-destructive and undoable.

- **[pdf.js](https://github.com/mozilla/pdf.js)** (`pdfjs-dist`) renders page thumbnails
  and image export (worker bundled for MV3 CSP).
- **[pdf-lib](https://github.com/Hopding/pdf-lib)** rebuilds the output document on export.
  Pages are copied **batched per source document** so shared resources (fonts/images)
  aren't duplicated per page.
- **[@dnd-kit](https://dndkit.com/)** powers the sortable thumbnail grid.
- **[@crxjs/vite-plugin](https://crxjs.dev/)** builds the MV3 bundle; fonts are bundled
  locally via **@fontsource**.

## Testing

- **Unit** (`npm test`) — pure logic: `pageModel` transforms, `pageRange` parsing, and the
  `pdfExport` pipeline (page count/order, rotation, crop box, merge, and a resource
  de-duplication regression test). The editor hooks (`useToast`, `useDialogs`, `useExport`,
  `usePeek`) are tested via `@testing-library/react`'s `renderHook` — those files opt into a
  jsdom environment with a `// @vitest-environment jsdom` docblock; everything else runs in
  Node. Persistence and keyboard reordering, which need IndexedDB and a real browser, are
  exercised by headless-extension smoke checks rather than unit tests.
- **E2E** (`npm run e2e`) — loads the built extension in headless Chromium and exercises
  load/render, delete, rotate, extract, Mix, split-every-N, range export, images↔PDF,
  the lightbox, and theme switching. (Drag-reorder is covered by unit tests and manual
  checks — dnd-kit's pointer sensor doesn't engage with synthetic events.)

## Project layout

```
src/
  manifest.ts         MV3 manifest
  background.ts        service worker — opens the editor, context menus, tab handoff
  icons/icon.svg       icon source (npm run icons → PNGs)
  editor/
    App.tsx            top-level state wiring
    store.ts           reducer + undo/redo history
    themes.ts          the four Looks (CSS-var token sets)
    components/        Header, Toolbar, ThumbnailGrid, PageThumb, PagePeek, Lightbox,
                       CropDialog, RangeDialog, ImagesDialog, MixDialog, SplitEveryDialog,
                       SelectionDock, EmptyState, LoadingState, Toast, DragOverlay
    hooks/             useToast, useDialogs, useExport, useAutosave, usePeek
    lib/
      pageModel.ts     PageDescriptor type + pure operations
      ingest.ts        load PDFs / images from file, URL, or tab
      pdfRender.ts     pdf.js thumbnails + full-res bitmap (for image export)
      pdfExport.ts     pdf-lib export (single + split)
      pdfImages.ts     PDF → images (download each or as one .zip via fflate)
      persist.ts       IndexedDB autosave / restore of the working session
      pageRange.ts     "1-3, 5" range parsing
e2e/                   Playwright tests
```

## Limitations

No content/text editing, OCR, form filling, or annotations. Work is autosaved locally and
offered back on reload, but there's no cross-device sync or named projects. The original
file is never overwritten — output is always a fresh download. Encrypted PDFs may fail to
load.

## License

[MIT](LICENSE) © Billy Ye
