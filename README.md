# PDF Page Manager

A Chrome extension (Manifest V3) for managing PDF pages — entirely in your browser.
Nothing is uploaded; all parsing and writing happens locally.

## Features

- **Reorder** pages by drag & drop
- **Delete / extract** pages (delete the rest, export what's left)
- **Rotate** pages (per page or batch on a selection)
- **Merge** — add multiple PDFs and they append into one document
- **Split** — mark section boundaries (✂) and export one file per section
- **Crop** — draw one region and apply it to all or just the selected pages
- **Undo / redo** (Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z)
- Load from a **local file** (picker or drag-drop) or the **PDF open in the current tab**

## Develop

```bash
npm install
npm run dev      # Vite dev server with HMR
npm run build    # production build → dist/
```

> If `npm install` warns about skipped install scripts, run
> `npm approve-scripts esbuild` once (esbuild needs its native binary).

## Load in Chrome

1. `npm run build`
2. Go to `chrome://extensions`, enable **Developer mode** (top right).
3. Click **Load unpacked** and select the `dist/` folder.
4. **To edit PDFs opened from your file system** (`file://…`), click **Details** on the
   extension card and enable **"Allow access to file URLs"**.

## Usage

- Click the toolbar icon to open the editor in a new tab.
  - If a PDF is open in the active tab, it loads automatically.
- Or use **+ Add PDF** / drag a file into the window.
- Select pages (click; Cmd/Ctrl-click to multi-select; Shift-click for a range),
  then rotate / delete / crop.
- Click **Export PDF** to download `‹name›-edited.pdf`. With split marks set,
  **Export split…** downloads one file per section (`‹name›-part1.pdf`, …).

## How it works

The editor's state is an ordered list of **page descriptors**
(`{ docId, pageIndex, rotation, crop }`) — not raw PDF bytes. Every operation is a
pure transform over that list, which keeps edits non-destructive and undoable.

- **[pdf.js](https://github.com/mozilla/pdf.js)** (`pdfjs-dist`) renders page thumbnails.
- **[pdf-lib](https://github.com/Hopding/pdf-lib)** rebuilds the output document on export
  (copy pages, apply rotation, set crop box).
- **[@dnd-kit](https://dndkit.com/)** powers the sortable thumbnail grid.
- **[@crxjs/vite-plugin](https://crxjs.dev/)** builds the MV3 bundle.

## Project layout

```
src/
  manifest.ts        MV3 manifest
  background.ts       service worker — opens the editor, hands off the tab's PDF
  editor/
    App.tsx           top-level state wiring
    store.ts          reducer + undo/redo history
    components/       Toolbar, ThumbnailGrid, PageThumb, CropDialog
    lib/
      pageModel.ts    PageDescriptor type + pure operations
      ingest.ts       load PDFs from file / URL
      pdfRender.ts    pdf.js thumbnail rendering
      pdfExport.ts    pdf-lib export (single + split)
```

## Limitations (v1)

No content/text editing, OCR, form filling, or annotations. The original file is never
overwritten in place — output is always a fresh download. Encrypted PDFs may fail to load.
