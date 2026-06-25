// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePeek, PRESS_PEEK_DELAY } from './usePeek';

// A fake card element with a stable rect, used as the peek anchor.
const rect = { left: 10, top: 20, width: 100, height: 130 } as DOMRect;
function rootRef() {
  return { current: { getBoundingClientRect: () => rect } as unknown as HTMLElement };
}

// Minimal pointer-event stand-ins (usePeek only reads these four fields).
const touch = (over = {}) => ({
  pointerType: 'touch',
  clientX: 0,
  clientY: 0,
  buttons: 1,
  ...over,
});
const mouse = (over = {}) => ({
  pointerType: 'mouse',
  clientX: 0,
  clientY: 0,
  buttons: 1,
  ...over,
});

describe('usePeek', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('opens a peek after a held touch press', () => {
    const { result } = renderHook(() => usePeek(rootRef()));
    act(() => result.current.onPointerDown(touch()));
    expect(result.current.peekAnchor).toBeNull(); // not yet
    act(() => vi.advanceTimersByTime(PRESS_PEEK_DELAY));
    expect(result.current.peekAnchor).toBe(rect);
  });

  it('never peeks for mouse input', () => {
    const { result } = renderHook(() => usePeek(rootRef()));
    act(() => result.current.onPointerDown(mouse()));
    act(() => vi.advanceTimersByTime(PRESS_PEEK_DELAY * 2));
    expect(result.current.peekAnchor).toBeNull();
  });

  it('a press that moves past the threshold (a drag) cancels the pending peek', () => {
    const { result } = renderHook(() => usePeek(rootRef()));
    act(() => result.current.onPointerDown(touch()));
    act(() => result.current.onPointerMove(touch({ clientX: 20, clientY: 0 }))); // 20px > 8px
    act(() => vi.advanceTimersByTime(PRESS_PEEK_DELAY));
    expect(result.current.peekAnchor).toBeNull();
  });

  it('keeps the peek for small jitter under the threshold', () => {
    const { result } = renderHook(() => usePeek(rootRef()));
    act(() => result.current.onPointerDown(touch()));
    act(() => result.current.onPointerMove(touch({ clientX: 4, clientY: 3 }))); // 5px < 8px
    act(() => vi.advanceTimersByTime(PRESS_PEEK_DELAY));
    expect(result.current.peekAnchor).toBe(rect);
  });

  it('lifting the finger dismisses an open peek', () => {
    const { result } = renderHook(() => usePeek(rootRef()));
    act(() => result.current.onPointerDown(touch()));
    act(() => vi.advanceTimersByTime(PRESS_PEEK_DELAY));
    expect(result.current.peekAnchor).toBe(rect);
    act(() => result.current.onPointerUp(touch()));
    expect(result.current.peekAnchor).toBeNull();
  });

  it('suppresses exactly one click after a long-press peek', () => {
    const { result } = renderHook(() => usePeek(rootRef()));
    act(() => result.current.onPointerDown(touch()));
    act(() => vi.advanceTimersByTime(PRESS_PEEK_DELAY));
    // The click that ends the press is swallowed, the next one is not.
    expect(result.current.consumeClickSuppression()).toBe(true);
    expect(result.current.consumeClickSuppression()).toBe(false);
  });

  it('does not suppress clicks when no peek opened (a quick tap)', () => {
    const { result } = renderHook(() => usePeek(rootRef()));
    act(() => result.current.onPointerDown(touch()));
    act(() => vi.advanceTimersByTime(PRESS_PEEK_DELAY / 2)); // released before the delay
    act(() => result.current.onPointerUp(touch()));
    expect(result.current.consumeClickSuppression()).toBe(false);
  });
});
