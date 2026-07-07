import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import type { Action, AppState } from '../store';
import { consumePendingSource, ensureHostPermission, ingestUrl } from '../lib/ingest';
import type { LoadedDoc } from '../lib/pdfRender';

interface Args {
  dispatch: Dispatch<Action>;
  setDocs: Dispatch<SetStateAction<Map<string, LoadedDoc>>>;
  setAppState: (s: AppState) => void;
  showToast: (message: string, tone?: 'success' | 'error') => void;
  clearRestorable: () => void;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname || 'this tab';
  } catch {
    return 'this tab';
  }
}

/**
 * The "a PDF from <host> is ready to load" banner. On first load, notes the
 * active tab's PDF (if the background script handed one off) and offers to
 * load it. We don't fetch automatically: fetching needs host access, which is
 * only requested on an explicit user click (loadPending).
 */
export function usePendingSource({
  dispatch,
  setDocs,
  setAppState,
  showToast,
  clearRestorable,
}: Args) {
  const [pendingSource, setPendingSource] = useState<string | null>(null);

  useEffect(() => {
    let done = false;
    (async () => {
      const url = await consumePendingSource();
      if (url && !done) setPendingSource(url);
    })();
    return () => {
      done = true;
    };
  }, []);

  // User clicked "Load PDF" in the banner — request that origin's host
  // permission (within this gesture), then fetch and ingest.
  const loadPending = useCallback(async () => {
    const url = pendingSource;
    if (!url) return;
    clearRestorable();
    const granted = await ensureHostPermission(url);
    setPendingSource(null);
    if (!granted) {
      showToast('Permission needed to load that PDF', 'error');
      return;
    }
    setAppState('loading');
    try {
      const { doc, pages: newPages } = await ingestUrl(url);
      setDocs((prev) => new Map(prev).set(doc.id, doc));
      dispatch({ type: 'addPages', pages: newPages });
      setAppState('editor');
      showToast(`Loaded ${newPages.length} page${newPages.length === 1 ? '' : 's'}`);
    } catch (e) {
      showToast(`Could not load that PDF: ${(e as Error).message}`, 'error');
      setAppState('empty');
    }
  }, [pendingSource, clearRestorable, dispatch, setDocs, setAppState, showToast]);

  const dismiss = useCallback(() => setPendingSource(null), []);

  return {
    pendingSource,
    pendingHost: pendingSource ? hostOf(pendingSource) : null,
    loadPending,
    dismiss,
  };
}
