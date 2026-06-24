import { useCallback, useRef, useState } from 'react';

export interface ToastState {
  message: string;
  tone: 'success' | 'error';
}

/**
 * A single auto-dismissing toast. `showToast` replaces any current toast and
 * resets the dismiss timer, so rapid calls each get the full duration.
 */
export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<number | null>(null);

  const showToast = useCallback(
    (message: string, tone: 'success' | 'error' = 'success') => {
      setToast({ message, tone });
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        setToast(null);
        timer.current = null;
      }, 3500);
    },
    [],
  );

  return { toast, showToast };
}
