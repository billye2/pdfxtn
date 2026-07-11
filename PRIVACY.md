# Privacy Policy — PDF Mana

_Last updated: 2026-07-11_

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
device. For convenience, the extension keeps two things in your browser's local
storage (IndexedDB), still entirely on your device:

- an autosave of your current session, so an accidental reload can offer to restore
  your work — cleared when you empty the editor;
- a short list of recently opened files (the pin button), so you can reopen one without
  finding it again — capped to the last 10 files (pinned files are kept until you remove
  them). You can remove any entry, use "Clear all", or turn the feature off entirely with
  the "Remember opened files" switch in that dialog.

## Permissions

- **activeTab** — to read the URL of the PDF open in your current tab when you click the
  icon, so it can be offered for editing.
- **storage** — a one-time, in-memory handoff of that URL from the background worker to
  the editor tab. Cleared when the browser closes.
- **contextMenus** — to add the right-click "Open in PDF Mana" items on PDF links/pages.
- **optional host access** — requested only at the moment you click "Load PDF" to open a
  PDF from your tab or a right-clicked link, and scoped to that PDF's site (not all sites).
  It lets the extension fetch the PDF's bytes, which are processed locally and never sent
  anywhere. Editing local files needs no host access at all.

## Changes

If this policy changes, the updated version will be published in this repository.

## Contact

Questions: open an issue at https://github.com/billye2/pdfxtn/issues
