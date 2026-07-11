import { useCallback, useEffect, useState } from 'react';
import {
  loadRecents,
  removeRecent as removeStored,
  clearRecents as clearStored,
  type RecentMeta,
} from '../lib/persist';

/**
 * The previously-opened-files list backing the star dialog. Loads fresh from
 * IndexedDB each time `enabled` flips true (dialog open), so entries recorded
 * since the last open always show up. Removes are optimistic: the list state
 * updates immediately and the IDB delete runs best-effort behind it.
 */
export function useRecents(enabled: boolean) {
  const [recents, setRecents] = useState<RecentMeta[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    loadRecents().then((r) => {
      if (!cancelled) setRecents(r);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const removeRecent = useCallback((hash: string) => {
    setRecents((prev) => prev.filter((r) => r.hash !== hash));
    removeStored(hash).catch(() => {});
  }, []);

  const clearRecents = useCallback(() => {
    setRecents([]);
    clearStored().catch(() => {});
  }, []);

  return { recents, removeRecent, clearRecents };
}
