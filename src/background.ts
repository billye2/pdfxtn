// Service worker: opens the editor tab, optionally handing off a PDF URL for it
// to fetch. Sources: the toolbar icon (active tab) and right-click context menus
// (a PDF link, or the PDF page you're viewing).

const PDF_SOURCE_KEY = 'pendingPdfSource';

const PDF_PATTERNS = ['*://*/*.pdf*', 'file:///*.pdf*'];

function looksLikePdf(url: string | undefined): boolean {
  if (!url) return false;
  try {
    return new URL(url).pathname.toLowerCase().endsWith('.pdf');
  } catch {
    return false;
  }
}

/** Stash the source URL (or null) and open the editor in a new tab. */
async function openEditor(source: string | null): Promise<void> {
  // session storage is cleared on browser close and isn't synced — ideal for a
  // one-shot handoff to the editor tab.
  await chrome.storage.session.set({ [PDF_SOURCE_KEY]: source });
  await chrome.tabs.create({ url: chrome.runtime.getURL('src/editor/index.html') });
}

// Toolbar icon → load the active tab's PDF if it is one.
chrome.action.onClicked.addListener((tab) => {
  void openEditor(looksLikePdf(tab?.url) ? tab!.url! : null);
});

// (Re)create context menus on install/update. The service worker may restart,
// but menus persist; creating in onInstalled avoids duplicate-id errors.
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'open-pdf-link',
    title: 'Open link in Mana',
    contexts: ['link'],
    targetUrlPatterns: PDF_PATTERNS,
  });
  chrome.contextMenus.create({
    id: 'open-pdf-page',
    title: 'Open this PDF in Mana',
    contexts: ['page'],
    documentUrlPatterns: PDF_PATTERNS,
  });
});

chrome.contextMenus.onClicked.addListener((info) => {
  const url =
    info.menuItemId === 'open-pdf-link'
      ? info.linkUrl ?? null
      : info.pageUrl ?? null;
  void openEditor(url);
});
