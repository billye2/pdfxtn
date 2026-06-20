# Chrome Web Store — submission package

Everything you need to paste into the Developer Dashboard for PDF Mana 1.0.0.

## Upload package

- **File:** `release/pdf-mana-1.0.0.zip` (built from `dist/`, manifest.json at the zip root).
- Rebuild + repackage anytime: `npm run build` then
  `cd dist && zip -qr ../release/pdf-mana-1.0.0.zip .`

## Listing fields

**Name:** PDF Mana

**Summary (short description, ≤132 chars):**
> Merge, arrange, rotate, split, crop & convert PDF pages — fast, friendly, and 100% local. Nothing is ever uploaded.

**Category:** Productivity (alt: Tools)

**Language:** English

**Detailed description:**
> PDF Mana is a friendly, all-on-your-device PDF page manager. Open a PDF (or several),
> then reorder, rotate, delete, extract, merge, split, and crop pages — and export a fresh
> file. Everything happens in your browser; your documents are never uploaded.
>
> Features:
> • Reorder pages by dragging
> • Delete pages, or "Keep these" to extract just the ones you want
> • Rotate pages individually or in bulk
> • Merge multiple PDFs into one
> • Mix / interleave two PDFs — perfect for double-sided scans done on a single-sided feeder
> • Split by hand or every N pages — export one file per part
> • Crop a region and apply it to all or selected pages
> • Images → PDF: drop JPG/PNG files in and they become pages
> • PDF → Images: export pages as PNG or JPG
> • Export any page range
> • Large page preview with arrow-key paging
> • Four playful themes
> • Undo/redo, and a warning before you lose unsaved work
>
> 100% local — no servers, no accounts, no tracking. Open source (MIT).

**Single purpose (required):**
> Manage the pages of PDF files locally — reorder, rotate, delete, merge, split, crop, and
> convert between PDF and images — entirely in the browser.

## Privacy & data

- **Privacy policy URL:** https://github.com/billye2/pdfxtn/blob/main/PRIVACY.md
- **Data collection:** None. Declare "does not collect or use" for every data category.
- **Disclosures to check:** "I do not sell or transfer user data to third parties," "…not
  use or transfer for purposes unrelated to the item's single purpose," "…not use or
  transfer to determine creditworthiness / for lending."

## Permission justifications (paste per-permission)

- **activeTab:** Read the URL of the PDF open in the user's active tab when they click the
  toolbar icon, so it can be loaded for editing.
- **tabs:** Open the editor in a new tab and read the active tab's URL on icon click.
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
- **Screenshots (1280×800):** `release/screenshots/01-editor.png` … `04-theme.png`
  (regenerate with `node scripts/screenshots.mjs`). At least one is required; up to five.
- **Promo tiles (optional):** `release/promo/small-440x280.png` and
  `release/promo/marquee-1400x560.png` (regenerate with `node scripts/promo.mjs`).

## Pre-submit checklist

- [ ] `npm run build` is clean; `release/pdf-mana-1.0.0.zip` is fresh.
- [ ] Register as a Chrome Web Store developer (one-time $5 fee) at
      https://chrome.google.com/webstore/devconsole
- [ ] Create item → upload the ZIP.
- [ ] Fill listing (name, summary, description, category, language).
- [ ] Upload icon + at least one screenshot.
- [ ] Set Privacy policy URL; complete the data-usage and permission-justification forms.
- [ ] Choose visibility (Public / Unlisted) and distribution regions.
- [ ] Submit for review (first review typically a few days; broad host permissions can add time).
