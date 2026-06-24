import { useEffect } from 'react';
import type { PageDescriptor } from '../lib/pageModel';
import type { LoadedDoc } from '../lib/pdfRender';
import { clearSession, saveDocs, saveState } from '../lib/persist';

interface Args {
  pages: PageDescriptor[];
  splitMarks: Set<string>;
  docs: Map<string, LoadedDoc>;
  look: string;
  /** Only persist once the editor is live (avoids clobbering on first mount). */
  active: boolean;
}

const DEBOUNCE_MS = 800;

/**
 * Mirror the working session into IndexedDB. Doc bytes are written once when the
 * doc set changes; the lightweight descriptor state is debounced on every edit.
 * Emptying the editor clears the saved session.
 */
export function useAutosave({ pages, splitMarks, docs, look, active }: Args) {
  // Source bytes: written when the doc set changes (add/load/restore), not edits.
  useEffect(() => {
    if (!active || docs.size === 0) return;
    saveDocs(
      [...docs.values()].map((d) => ({ id: d.id, name: d.name, bytes: d.bytes })),
    ).catch(() => {});
  }, [docs, active]);

  // Descriptor state: debounced so a burst of edits collapses into one write.
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => {
      if (pages.length === 0) {
        clearSession().catch(() => {});
        return;
      }
      saveState({
        savedAt: Date.now(),
        pages,
        splitMarks: [...splitMarks],
        look,
      }).catch(() => {});
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [pages, splitMarks, look, active]);
}
