import { useEffect, useRef, useState, type RefObject } from 'react';

export const PRESS_PEEK_DELAY = 500; // ms of long-press before the peek appears
const MOVE_CANCEL_PX = 8; // movement past this is a drag, not a peek

/** The pointer fields the peek logic needs — a React.PointerEvent satisfies it. */
interface PeekPointer {
  pointerType: string;
  clientX: number;
  clientY: number;
  buttons: number;
}

/**
 * The long-press "peek" state machine, factored out of PageThumb so it can be
 * tested without rendering pdf.js. A touch/pen press held still for
 * PRESS_PEEK_DELAY opens a peek anchored to `rootRef`; moving past the drag
 * threshold, lifting, or leaving dismisses it. Mouse input never peeks (the
 * popover would cover the card controls). The press that ends a peek is flagged
 * so it doesn't also select the card.
 */
export function usePeek(rootRef: RefObject<HTMLElement | null>) {
  const [peekAnchor, setPeekAnchor] = useState<DOMRect | null>(null);
  const timer = useRef<number | null>(null);
  const pressPos = useRef<{ x: number; y: number } | null>(null);
  const suppressClick = useRef(false);

  const clearTimer = () => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };
  const hide = () => {
    clearTimer();
    setPeekAnchor(null);
  };

  // Scrolling the grid or resizing invalidates the anchor rect, so dismiss the
  // peek — but ignore scrolls from inside the peek (it scrolls its own page).
  useEffect(() => {
    if (!peekAnchor) return;
    const dismiss = (e: Event) => {
      if (e.target instanceof Element && e.target.closest('.page-peek')) return;
      clearTimer();
      setPeekAnchor(null);
    };
    window.addEventListener('scroll', dismiss, true);
    window.addEventListener('resize', dismiss);
    return () => {
      window.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('resize', dismiss);
    };
  }, [peekAnchor]);

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  const onPointerDown = (e: PeekPointer) => {
    pressPos.current = { x: e.clientX, y: e.clientY };
    if (e.pointerType === 'mouse') return; // mouse/hover never peeks
    clearTimer();
    timer.current = window.setTimeout(() => {
      const node = rootRef.current;
      if (!node) return;
      suppressClick.current = true;
      setPeekAnchor(node.getBoundingClientRect());
    }, PRESS_PEEK_DELAY);
  };

  const onPointerMove = (e: PeekPointer) => {
    const start = pressPos.current;
    if (!start || e.buttons === 0) return; // ignore plain hover (no button held)
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > MOVE_CANCEL_PX) {
      pressPos.current = null;
      hide();
    }
  };

  const onPointerUp = (e: PeekPointer) => {
    pressPos.current = null;
    if (e.pointerType !== 'mouse') hide();
  };

  const onPointerCancel = () => {
    pressPos.current = null;
    hide();
  };

  const onPointerLeave = () => hide();

  /** True exactly once after a long-press opened a peek; call it from onClick. */
  const consumeClickSuppression = () => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return true;
    }
    return false;
  };

  return {
    peekAnchor,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onPointerLeave,
    consumeClickSuppression,
  };
}
