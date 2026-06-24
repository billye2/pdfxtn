import { useState } from 'react';

/** The modal dialogs the editor can show — at most one open at a time. */
export type DialogId = 'crop' | 'range' | 'mix' | 'splitEvery' | 'images';

/**
 * Tracks which dialog (if any) is open. A single source of truth replaces one
 * boolean per dialog and enforces the "only one modal at a time" invariant.
 */
export function useDialogs() {
  const [open, setOpen] = useState<DialogId | null>(null);
  return {
    isOpen: (id: DialogId) => open === id,
    openDialog: (id: DialogId) => setOpen(id),
    closeDialog: () => setOpen(null),
  };
}
