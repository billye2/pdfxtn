// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { act } from '@testing-library/react';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import type { PageDescriptor } from '../lib/pageModel';

// e2e covers the main paths (arrow nudge + undo, Space toggle, Esc, Delete);
// this covers only what it can't: the typing guard, redo aliases, Backspace,
// and the edge clamp.

const mkPages = (n: number): PageDescriptor[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    docId: 'd1',
    pageIndex: i,
    rotation: 0,
  }));

function setup(over: Partial<Parameters<typeof useKeyboardShortcuts>[0]> = {}) {
  const dispatch = vi.fn();
  const setPreviewIndex = vi.fn();
  renderHook(() =>
    useKeyboardShortcuts({
      pages: mkPages(3),
      selected: new Set(['p0']),
      previewIndex: null,
      setPreviewIndex,
      dispatch,
      ...over,
    }),
  );
  return { dispatch, setPreviewIndex };
}

function press(key: string, init: KeyboardEventInit = {}, target?: EventTarget) {
  const e = new KeyboardEvent('keydown', { key, bubbles: true, ...init });
  act(() => {
    (target ?? window).dispatchEvent(e);
  });
  return e;
}

describe('useKeyboardShortcuts', () => {
  it('ignores Delete and Space while typing in an input', () => {
    const input = document.createElement('input');
    document.body.append(input);
    const { dispatch, setPreviewIndex } = setup();
    press('Delete', {}, input);
    press(' ', {}, input);
    expect(dispatch).not.toHaveBeenCalled();
    expect(setPreviewIndex).not.toHaveBeenCalled();
    input.remove();
  });

  it('mod+y and mod+shift+z both redo', () => {
    const { dispatch } = setup();
    press('y', { metaKey: true });
    press('z', { metaKey: true, shiftKey: true });
    expect(dispatch).toHaveBeenNthCalledWith(1, { type: 'redo' });
    expect(dispatch).toHaveBeenNthCalledWith(2, { type: 'redo' });
  });

  it('Backspace deletes the selection like Delete', () => {
    const { dispatch } = setup();
    press('Backspace');
    expect(dispatch).toHaveBeenCalledWith({ type: 'deleteSelected' });
  });

  it('nudging the first page left is a no-op at the edge', () => {
    const { dispatch } = setup(); // p0 selected, position 0
    press('ArrowLeft');
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('announces a successful nudge via the live message', () => {
    const dispatch = vi.fn();
    const { result } = renderHook(() =>
      useKeyboardShortcuts({
        pages: mkPages(3),
        selected: new Set(['p0']),
        previewIndex: null,
        setPreviewIndex: vi.fn(),
        dispatch,
      }),
    );
    press('ArrowRight');
    expect(dispatch).toHaveBeenCalledWith({ type: 'reorder', from: 0, to: 1 });
    expect(result.current.liveMsg).toBe('Moved page to position 2 of 3.');
  });
});
