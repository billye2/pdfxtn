# Privacy Policy — PDF Mana

_Last updated: 2026-06-20_

PDF Mana is a Chrome extension that manages PDF pages entirely on your device.

## What we collect

**Nothing.** PDF Mana does not collect, store, transmit, sell, or share any personal
information or user data. There are no analytics, no tracking, no accounts, and no
remote servers.

## How your files are handled

All PDF and image processing happens locally in your browser:

- Files you open (via the picker, drag-and-drop, the PDF in your active tab, or a
  right-clicked PDF link) are read into memory in the extension's editor page.
- Pages are rendered and rebuilt locally using bundled libraries (pdf.js and pdf-lib).
- Exported files are saved directly to your computer via the browser's download feature.

Your documents are **never uploaded** to any third party or to us. They stay on your
device and are discarded when you close the editor tab.

## Permissions

- **activeTab / tabs** — to read the URL of the PDF open in your current tab (when you
  click the icon) and to open the editor in a new tab.
- **storage** — a one-time, in-memory handoff of that URL from the background worker to
  the editor tab. Cleared when the browser closes.
- **contextMenus** — to add the right-click "Open in PDF Mana" items on PDF links/pages.
- **host access (`<all_urls>`)** — to fetch the bytes of a PDF you chose to open (the one
  in your tab or a link you right-clicked) so it can be loaded into the editor. These
  bytes are processed locally and never sent anywhere.

## Changes

If this policy changes, the updated version will be published in this repository.

## Contact

Questions: open an issue at https://github.com/billye2/pdfxtn/issues
