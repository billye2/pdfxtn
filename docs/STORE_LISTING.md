# Chrome Web Store — submission package

Everything you need to paste into the Developer Dashboard for PDF Mana.

## Upload package

- **File:** `release/pdf-mana-<version>.zip` (built from `dist/`, manifest.json at the zip root).
- (Re)package with **`npm run release`** — it bumps the patch version, builds, and writes a
  fresh version-named zip. Always use this so the uploaded version always increases (the Web
  Store rejects re-uploads of an existing version).

## Listing fields

**Name:** PDF Mana

**Summary (short description, ≤132 chars):**

> Merge, arrange, rotate, split, crop & convert PDF pages — fast, friendly, and 100% local. Nothing is ever uploaded.

**Category:** Productivity (alt: Tools)

**Language:** English

**Detailed description:**

> **PDF Mana — Merge · Arrange · Nip · Adjust**
>
> A friendly, all-on-your-device PDF page manager. Open a PDF (or several), rearrange and
> fix up the pages, and export a fresh file — without ever uploading your documents to a
> server. Everything happens right in your browser.
>
> **What you can do**
>
> 📄 **Arrange** — drag pages to reorder, delete the ones you don't need, or "Keep these"
> to pull out just the pages you want.
>
> 🔄 **Rotate** — turn a single page or a whole selection the right way up.
>
> ➕ **Merge** — combine several PDFs into one document.
>
> 🔀 **Mix / interleave** — weave two PDFs together page-by-page. Perfect for double-sided
> documents scanned on a single-sided feeder: scan the fronts, scan the backs, and Mix puts
> them in the right order with one click.
>
> ✂️ **Split** — mark your own section breaks, or split every N pages, and export one file
> per part.
>
> 🔳 **Crop** — draw a region and apply it to every page or just the ones you pick.
>
> 🖼️ **Images → PDF** — drop JPG or PNG files straight in and they become pages.
>
> 📸 **PDF → Images** — export pages as PNG or JPG at up to 3× resolution (all pages, your
> selection, or a custom range), and optionally bundle them all into a single .zip.
>
> 🔢 **Export any range** — save just the pages you want (e.g. 1-3, 5, 8-10).
>
> 🔍 **Preview** — double-click any page (or tap the magnifier) for a big, readable view
> that fills the width; scroll to read down a long page, page through with the arrow keys,
> and rotate, crop, or delete right there. On a touch screen, press and hold a page for a
> quick peek — handy for confirming the right one before you reorder on a small display.
>
> 💾 **Never lose your work** — your session is autosaved on your device as you go and
> offered back the next time you open PDF Mana, plus a heads-up before you accidentally
> close with unsaved changes.
>
> 📌 **Previously opened files** — the pin button lists the files you've opened before,
> ready to reopen with one click; pin your regulars and they stick around. Everything
> stays on your device, with per-file remove, "Clear all", and an off switch if you'd
> rather nothing be remembered at all.
>
> ⌨️ **Accessible** — reorder and edit pages entirely from the keyboard, with screen-reader
> announcements as you go.
>
> 🎨 **Make it yours** — five playful themes (including a dark mode) that remember
> your pick, undo/redo, and handy keyboard shortcuts.
>
> **Perfect for**
>
> - Stitching paperwork together: drop in every contract, receipt, and cover letter
>   you've got — pages simply append, and you drag them into the order you want before
>   saving one clean PDF.
> - Rescuing a messy scan: turn sideways pages right-side up, nip off crooked edges and
>   scanner shadows, and slip in a blank page where the feeder ate one.
> - Taming double-sided scans: your scanner gives you fronts and backs as two stacks or
>   one interleaved mess — Mix and Un-mix sort it into reading order (or back out of it)
>   in one click.
> - Sending only what's needed: keep just the pages that matter, or split a long document
>   every N pages so each section becomes its own file.
> - Working with images: JPG and PNG files become PDF pages the moment you drop them, and
>   any page can go back out as an image — one file each or a single .zip.
> - Keeping it to yourself: no upload, no account, no watermark — your files are processed
>   on your device and never leave it.
>
> **Private by design**
>
> Your files never leave your computer. PDF Mana has no servers, no accounts, no analytics,
> and no tracking — all PDF reading and writing happens locally in your browser. It doesn't
> even ask for access to any website until the moment you choose to open a PDF that's
> already in your tab.
>
> **Free and open source**
>
> PDF Mana is completely free and open source under the MIT license. Browse the code,
> report an issue, or contribute on GitHub:
> https://github.com/billye2/pdfxtn
>
> ---
>
> Tip: open a PDF in a tab and click the toolbar icon, right-click a PDF link to send it
> straight to PDF Mana, or just drag a file into the window.

> **Note:** The Web Store renders description URLs as plain text (not clickable). For a
> clickable link, also set the repo as the **Homepage URL** in the dashboard:
> _Store listing → Additional fields → Homepage URL_ → `https://github.com/billye2/pdfxtn`.

**Single purpose (required):**

> Manage the pages of PDF files locally — reorder, rotate, delete, merge, split, crop, and
> convert between PDF and images — entirely in the browser.

## Privacy & data

- **Privacy policy URL:** https://github.com/billye2/pdfxtn/blob/main/PRIVACY.md
- **Data collection:** None. Declare "does not collect or use" for every data category.
- **Remote code:** Select **"No, I am not using remote code."** All code/assets (pdf.js
  worker, fonts) are bundled; the extension executes no remotely-hosted or dynamically
  fetched code — it only fetches PDF _data_ the user opens (data, not code).
- **Disclosures to check (certify):** "I do not sell or transfer user data to third
  parties," "…not use or transfer for purposes unrelated to the item's single purpose,"
  "…not use or transfer to determine creditworthiness / for lending."

## Permission justifications (paste per-permission)

- **activeTab:** When the user clicks the toolbar icon, read the URL of the PDF open in the
  active tab so it can be offered for editing. (Opening the editor tab needs no permission.)
- **storage:** One-time in-memory (`session`) handoff of the chosen PDF's URL from the
  background service worker to the editor tab.
- **contextMenus:** Add the right-click "Open in PDF Mana" items for PDF links and pages.
- **optional host access (`optional_host_permissions: <all_urls>`):** Not granted by
  default. Requested at runtime — scoped to a single site — only when the user clicks
  "Load PDF" to open the PDF from their tab or a right-clicked link. The fetched bytes are
  processed locally and never transmitted. Local-file editing requires no host access.

> ✅ Host access is **optional** and user-initiated, so the extension installs with **no
> standing access to any site** — the lowest-friction posture for review.

## Assets

- **Store icon:** 128×128 — `dist/src/icons/icon128.png` (or export from `src/icons/icon.svg`).
- **Screenshots (1280×800):** `release/screenshots/01-hero.png` … `05-dark-free.png`
  (regenerate with `node scripts/screenshots.mjs`). Branded frames with benefit
  headlines, in upload order: 01 hero — "Tidy up any PDF — right in your browser"
  (mixed docs + photos board); 02 "Pick pages — fix them in one click" (multi-select
  - dock); 03 "Un-scramble double-sided scans" (Mix dialog + preset); 04 "Rescue
    messy scans" (crop dialog nipping shadow bands); 05 "Dark mode included — and
    it's all free" (Nighty Night board). At least one is required; up to five (all
    five are generated).
- **Promo tiles (optional):** `release/promo/small-440x280.png` and
  `release/promo/marquee-1400x560.png` (regenerate with `node scripts/promo.mjs`).
- **Promo video (optional):** `release/video/pdf-mana-promo.webm` — a ~51 s scripted
  demo at 1280×720, silent with caption overlays (regenerate with `npm run build &&
node scripts/promo-video.mjs`). The dashboard field takes a **YouTube URL**, not a
  file: upload the webm to YouTube (webm is accepted directly; add music there if
  desired), then paste the URL into "Promotional video". Convert to mp4 with ffmpeg
  only if some other outlet needs it.
  **Uploaded 2026-07-10:** https://www.youtube.com/watch?v=-0Jnd0kRKog — paste this
  URL into the dashboard's "Promotional video" field. A second cut focused on the
  page tools exists at `release/video/pdf-mana-promo-2.webm`
  (`node scripts/promo-video-2.mjs`), ~41 s, not yet uploaded.

## Pre-submit checklist

- [ ] `npm run release` produced a fresh `release/pdf-mana-<version>.zip` (version bumped).
- [ ] Register as a Chrome Web Store developer (one-time $5 fee) at
      https://chrome.google.com/webstore/devconsole
- [ ] Create item → upload the ZIP.
- [ ] Fill listing (name, summary, description, category, language).
- [ ] Upload icon + at least one screenshot.
- [ ] Set Privacy policy URL; complete the data-usage and permission-justification forms.
- [ ] Choose visibility (Public / Unlisted) and distribution regions.
- [ ] Submit for review (first review typically a few days; broad host permissions can add time).
