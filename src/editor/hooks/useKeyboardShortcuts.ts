import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import type { Action } from '../store';
import type { PageDescriptor } from '../lib/pageModel';

interface Args {
  pages: PageDescriptor[];
  selected: ReadonlySet<string>;
  previewIndex: number | null;
  setPreviewIndex: Dispatch<SetStateAction<number | null>>;
  dispatch: Dispatch<Action>;
}

/**
 * The global keyboard map: preview paging/closing, Space preview toggle,
 * arrow-key page nudging (the modeless drag alternative, announced via the
 * returned aria-live message), undo/redo, select-all, Esc, Delete.
 */
export function useKeyboardShortcuts({
  pages,
  selected,
  previewIndex,
  setPreviewIndex,
  dispatch,
}: Args) {
  const [liveMsg, setLiveMsg] = useState(''); // screen-reader announcements

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA';

      // While the preview is open, arrows page and Esc/Space close; nothing
      // else runs. (Space toggles: it opened the preview, so it also closes it.)
      if (previewIndex !== null) {
        if (e.key === 'Escape') setPreviewIndex(null);
        else if (e.key === ' ') {
          e.preventDefault();
          setPreviewIndex(null);
        } else if (e.key === 'ArrowRight')
          setPreviewIndex((i) => (i === null ? i : Math.min(i + 1, pages.length - 1)));
        else if (e.key === 'ArrowLeft')
          setPreviewIndex((i) => (i === null ? i : Math.max(i - 1, 0)));
        return;
      }

      // Space opens the preview for a single selected page.
      if (e.key === ' ' && !typing && selected.size === 1) {
        e.preventDefault();
        const id = [...selected][0];
        const idx = pages.findIndex((p) => p.id === id);
        if (idx >= 0) setPreviewIndex(idx);
        return;
      }

      // Left/Right nudge the single selected page one position — a modeless
      // keyboard alternative to dragging.
      if (
        (e.key === 'ArrowLeft' || e.key === 'ArrowRight') &&
        !typing &&
        selected.size === 1
      ) {
        const id = [...selected][0];
        const from = pages.findIndex((p) => p.id === id);
        const to = e.key === 'ArrowLeft' ? from - 1 : from + 1;
        if (from < 0 || to < 0 || to >= pages.length) return; // at an edge
        e.preventDefault();
        dispatch({ type: 'reorder', from, to });
        setLiveMsg(`Moved page to position ${to + 1} of ${pages.length}.`);
        return;
      }

      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? 'redo' : 'undo' });
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        dispatch({ type: 'redo' });
      } else if (mod && e.key.toLowerCase() === 'a' && !typing) {
        e.preventDefault();
        dispatch({ type: 'selectAll' });
      } else if (e.key === 'Escape') {
        dispatch({ type: 'clearSelection' });
      } else if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        selected.size > 0 &&
        !typing
      ) {
        e.preventDefault();
        dispatch({ type: 'deleteSelected' });
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // dispatch/setPreviewIndex are stable; deps match the original in App.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, previewIndex, pages]);

  return { liveMsg };
}
