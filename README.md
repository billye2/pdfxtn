# PDF Mana

**M**erge · **A**rrange · **N**ip · **A**djust

A Chrome extension (Manifest V3) for managing PDF pages — entirely in your browser.
Nothing is uploaded; all parsing and writing happens locally.

![PDF Mana demo: dropping PDFs to merge, rotating and deleting pages, cropping visually, and saving — all locally](docs/demo.gif)

**[Install from the Chrome Web Store](https://chromewebstore.google.com/detail/pdf-mana/bhkhobdaindpenllbgliigfafkkigpnk)** · [watch the full demo on YouTube](https://www.youtube.com/watch?v=-0Jnd0kRKog)

## Use cases

- **Stitching paperwork together** — drop in every contract, receipt, and cover letter
  you've got; pages simply append, and you drag them into the order you want before saving
  one clean PDF.
- **Rescuing a messy scan** — turn sideways pages right-side up, nip off crooked edges and
  scanner shadows, and slip in a blank page where the feeder ate one.
- **Taming double-sided scans** — your scanner gives you fronts and backs as two stacks or
  one interleaved mess; Mix and Un-mix sort it into reading order (or back out of it) in
  one click.
- **Sending only what's needed** — pick the pages that matter and keep just those, or
  split a long document every N pages so each section becomes its own file.
- **Working with images** — JPG and PNG files become PDF pages the moment you drop them,
  and any page can go back out as an image — one file each or a single `.zip`.
- **Keeping it to yourself** — no upload, no account, no watermark; your files are
  processed on your device and never leave it.

## Features

- **Reorder** pages — drag a whole card anywhere to move it, or select a page and
  nudge it with the ← / → arrow keys
- **Delete / extract** — remove pages, or "Keep these" to extract only the selected ones
- **Duplicate** pages (Cmd/Ctrl+D) — copies land right after their originals
- **Rotate** pages (per page or across a selection)
- **Reverse** the page order — the whole document, or just the selected pages
- **Merge** — add multiple PDFs and they append into one document
- **Mix / interleave** — combine documents alternately; one-click preset for
  double-sided scans done on a single-sided feeder
- **Un-mix** — the inverse: pull an interleaved document back apart into fronts and
  backs, optionally straight into two files
- **Insert a blank page** — sized and oriented to match its neighbor
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
- **Four themes** — switchable "Looks" (Blocks, Bubble, Sticker, and the
  Nighty Night dark theme); your last pick is remembered across sessions
- **Full keyboard support** — Tab to a page and Enter picks it (Shift+Enter for a
  range); R / C / B / K / S rotate, crop, insert a blank, keep, or split the picked
  pages; the crop box places, moves, and resizes with the arrow keys; press **?**
  for the built-in cheat sheet
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
- The header **?** cycles through usage tips; the **keyboard button** (or pressing
  `?`) opens the shortcuts cheat sheet; the **Look** picker switches themes.

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
  de-duplication regression test) plus IndexedDB persistence via `fake-indexeddb`. The editor
  hooks are tested via `@testing-library/react`'s `renderHook` — those files opt into a jsdom
  environment with a `// @vitest-environment jsdom` docblock; everything else runs in Node.
- **E2E** (`npm run e2e`) — loads the built extension in headless Chromium and exercises
  load/render, delete, rotate, extract, Mix, split-every-N, range export, images↔PDF
  (incl. the single-`.zip` bundle), the lightbox, theme switching, keyboard reorder + undo,
  the Space-toggle preview, and the autosave reload→restore round-trip. (Pointer drag-reorder
  is the one skipped case — dnd-kit's pointer sensor doesn't engage with synthetic events;
  it's covered by `pageModel` unit tests and the keyboard-reorder e2e.) The same run scans
  key screens with **axe-core** (WCAG 2.1 AA) in the default and dark Looks.
- **Visual regression** (`npm run visual`) — screenshots the grid, crop dialog, and lightbox
  in all four Looks against committed baselines (macOS-local; `visual:update` regenerates
  them after intentional UI changes).

## Project layout

```
src/
  manifest.ts         MV3 manifest
  background.ts        service worker — opens the editor, context menus, tab handoff
  icons/icon.svg       icon source (npm run icons → PNGs)
  editor/
    App.tsx            top-level state wiring
    store.ts           reducer + undo/redo history
    themes.ts          the four Looks (CSS-var token sets) + saved-look storage
    styles/base.css    shared reset, keyframes, button primitives, app shell
    components/        Header, Toolbar, ThumbnailGrid, PageThumb, PagePeek, Lightbox,
                       Banners, EditorDialogs, CropDialog, RangeDialog, ImagesDialog,
                       MixDialog, SplitEveryDialog, SelectionDock, EmptyState,
                       LoadingState, Toast, DragOverlay — each styled by a
                       co-located <Name>.css it imports
    hooks/             useToast, useDialogs, useExport, useAutosave, usePeek,
                       useSessionRestore, usePendingSource, useFileIngest,
                       useKeyboardShortcuts
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

## Scope

Mana is a page-level tool — merge, arrange, nip, adjust. **Text/content editing is a
deliberate non-goal and will never be added**: it's a different mental model, well covered
by Acrobat and others, and would dilute the focus. The same applies to OCR, form filling,
and annotations.

## Limitations

Work is autosaved locally and offered back on reload, but there's no cross-device sync or
named projects. The original file is never overwritten — output is always a fresh download.
Encrypted PDFs may fail to load.

## License

[MIT](LICENSE) © Billy Ye
