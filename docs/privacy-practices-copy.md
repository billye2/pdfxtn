# Privacy practices — copy & paste

Paste each block into the matching field on the Chrome Web Store **Privacy practices** tab.

---

## Single purpose

PDF Mana lets users manage the pages of PDF files locally in the browser — reorder, rotate, delete, extract, merge, split, crop, and convert between PDF and images — then export the result. All processing happens on the user's own device; nothing is uploaded.

---

## activeTab justification

When the user clicks the PDF Mana toolbar icon, activeTab lets the extension read the URL of the PDF open in the current tab so it can offer to load that PDF into the editor. Nothing is accessed beyond the tab on which the user explicitly invoked the extension.

---

## storage justification

The extension uses chrome.storage.session to pass the chosen PDF's URL one time from the background service worker to the newly opened editor tab. No user data is stored persistently; session storage is cleared when the browser closes.

---

## contextMenus justification

The extension adds "Open in PDF Mana" and "Open link in PDF Mana" right-click menu items on PDF pages and PDF links, so the user can send a PDF to the editor. No page content is read.
