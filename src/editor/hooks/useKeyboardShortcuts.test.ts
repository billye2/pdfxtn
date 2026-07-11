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

  // The Enter pick-toggle reads e.target: it must be the card element itself
  // (class "card" + data-page-id), never a button nested inside it.
  function mkCard(pageId: string) {
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.pageId = pageId;
    document.body.append(card);
    return card;
  }

  it('Enter on a focused card toggles it into the selection additively', () => {
    const card = mkCard('p1'); // p0 is selected; p1 is not
    const { dispatch } = setup();
    press('Enter', {}, card);
    expect(dispatch).toHaveBeenCalledWith({
      type: 'toggleSelect',
      id: 'p1',
      additive: true,
    });
    card.remove();
  });

  it('Shift+Enter on a focused card picks the range to it', () => {
    const card = mkCard('p2');
    const { dispatch } = setup();
    press('Enter', { shiftKey: true }, card);
    expect(dispatch).toHaveBeenCalledWith({ type: 'selectRangeTo', id: 'p2' });
    card.remove();
  });

  it('Enter from a button inside the card is left to the button', () => {
    const card = mkCard('p1');
    const btn = document.createElement('button');
    card.append(btn);
    const { dispatch } = setup();
    press('Enter', {}, btn);
    expect(dispatch).not.toHaveBeenCalled();
    card.remove();
  });

  it('announces picks and unpicks via the live message', () => {
    const card = mkCard('p0'); // p0 already selected → Enter removes it
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
    press('Enter', {}, card);
    expect(dispatch).toHaveBeenCalledWith({
      type: 'toggleSelect',
      id: 'p0',
      additive: true,
    });
    expect(result.current.liveMsg).toBe('Removed page 1 from the picked pages.');
    card.remove();
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
