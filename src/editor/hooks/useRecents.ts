import { useCallback, useEffect, useState } from 'react';
import {
  loadRecents,
  removeRecent as removeStored,
  clearRecents as clearStored,
  setRecentPinned,
  type RecentMeta,
} from '../lib/persist';
import { isRememberEnabled, setRememberEnabled } from '../lib/recents';

/**
 * The previously-opened-files list backing the star dialog. Loads fresh from
 * IndexedDB each time `enabled` flips true (dialog open), so entries recorded
 * since the last open always show up. Removes are optimistic: the list state
 * updates immediately and the IDB delete runs best-effort behind it.
 */
export function useRecents(enabled: boolean) {
  const [recents, setRecents] = useState<RecentMeta[]>([]);
  const [remember, setRemember] = useState(isRememberEnabled);

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

  // Optimistic like removes; keeps the list order stable while the dialog is
  // open (pinned-first regrouping applies on the next load).
  const togglePin = useCallback((hash: string) => {
    setRecents((prev) => {
      const target = prev.find((r) => r.hash === hash);
      if (target) setRecentPinned(hash, !target.pinned).catch(() => {});
      return prev.map((r) => (r.hash === hash ? { ...r, pinned: !r.pinned } : r));
    });
  }, []);

  const toggleRemember = useCallback(() => {
    setRemember((prev) => {
      setRememberEnabled(!prev);
      return !prev;
    });
  }, []);

  return { recents, removeRecent, clearRecents, togglePin, remember, toggleRemember };
}
