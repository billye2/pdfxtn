import { useCallback, useEffect, useState, type Dispatch } from 'react';
import type { Action, AppState } from '../store';
import { clearSession, loadSession, type RestoredSession } from '../lib/persist';
import { loadDoc, type LoadedDoc } from '../lib/pdfRender';
import type { LookId } from '../themes';

interface Args {
  dispatch: Dispatch<Action>;
  setDocs: (docs: Map<string, LoadedDoc>) => void;
  setLook: (look: LookId) => void;
  setAppState: (s: AppState) => void;
  showToast: (message: string, tone?: 'success' | 'error') => void;
}

/**
 * The autosave restore offer: probes IndexedDB for a saved session on mount
 * and owns the Restore/Discard flows behind the banner. Restoring re-parses
 * each stored PDF and rehydrates pages/splits/look; discarding waits for the
 * IndexedDB clear to commit before dismissing, so the offer can't reappear if
 * the tab is reloaded/closed right after.
 */
export function useSessionRestore({
  dispatch,
  setDocs,
  setLook,
  setAppState,
  showToast,
}: Args) {
  const [restorable, setRestorable] = useState<RestoredSession | null>(null);

  // On first load, look for an autosaved session and offer to restore it.
  useEffect(() => {
    let done = false;
    loadSession()
      .then((session) => {
        if (session && !done) setRestorable(session);
      })
      .catch(() => {});
    return () => {
      done = true;
    };
  }, []);

  // Rebuild the saved session: re-parse each stored PDF, then load the pages.
  const restoreSession = useCallback(async () => {
    const session = restorable;
    if (!session) return;
    setRestorable(null);
    setAppState('loading');
    try {
      const map = new Map<string, LoadedDoc>();
      for (const d of session.docs) map.set(d.id, await loadDoc(d.id, d.name, d.bytes));
      setDocs(map);
      dispatch({
        type: 'restore',
        pages: session.state.pages,
        splitMarks: session.state.splitMarks,
      });
      setLook(session.state.look as LookId);
      setAppState('editor');
      showToast(`Restored ${session.state.pages.length} pages`);
    } catch (e) {
      showToast(`Could not restore: ${(e as Error).message}`, 'error');
      setAppState('empty');
    }
  }, [restorable, dispatch, setDocs, setLook, setAppState, showToast]);

  const discardSession = useCallback(async () => {
    try {
      await clearSession();
    } finally {
      setRestorable(null);
    }
  }, []);

  const clearRestorable = useCallback(() => setRestorable(null), []);

  return { restorable, clearRestorable, restoreSession, discardSession };
}
