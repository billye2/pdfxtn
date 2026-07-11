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

  it('R rotates the picked pages; Shift+R goes counter-clockwise', () => {
    const { dispatch } = setup();
    press('r');
    expect(dispatch).toHaveBeenCalledWith({ type: 'rotateSelected', delta: 90 });
    press('R', { shiftKey: true });
    expect(dispatch).toHaveBeenCalledWith({ type: 'rotateSelected', delta: -90 });
  });

  it('K keeps the picked pages; C/B/S call their handlers', () => {
    const onOpenCrop = vi.fn();
    const onInsertBlank = vi.fn();
    const onSplitPicked = vi.fn();
    const { dispatch } = setup({ onOpenCrop, onInsertBlank, onSplitPicked });
    press('k');
    expect(dispatch).toHaveBeenCalledWith({ type: 'extractSelected' });
    press('c');
    press('b');
    press('s');
    expect(onOpenCrop).toHaveBeenCalledTimes(1);
    expect(onInsertBlank).toHaveBeenCalledTimes(1);
    expect(onSplitPicked).toHaveBeenCalledTimes(1);
  });

  it('the whole global map is inert while a dialog is open', () => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    document.body.append(backdrop);
    const { dispatch, setPreviewIndex } = setup(); // p0 picked
    press('r');
    press('k');
    press('ArrowRight'); // would nudge the page behind the modal
    press(' '); // would open the preview behind the modal
    press('Delete'); // would delete behind the modal
    expect(dispatch).not.toHaveBeenCalled();
    expect(setPreviewIndex).not.toHaveBeenCalled();
    backdrop.remove();
  });

  it('action letters need a selection and no Cmd/Ctrl (browser Cmd+R survives)', () => {
    const onOpenCrop = vi.fn();
    const empty = setup({ selected: new Set<string>(), onOpenCrop });
    press('r');
    press('c');
    expect(empty.dispatch).not.toHaveBeenCalled();
    expect(onOpenCrop).not.toHaveBeenCalled();

    const { dispatch } = setup();
    press('r', { metaKey: true });
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'rotateSelected' }),
    );
  });

  it('"?" opens the shortcuts cheat sheet, but not while typing', () => {
    const onShowShortcuts = vi.fn();
    setup({ onShowShortcuts });
    press('?');
    expect(onShowShortcuts).toHaveBeenCalledTimes(1);

    const input = document.createElement('input');
    document.body.append(input);
    press('?', {}, input);
    expect(onShowShortcuts).toHaveBeenCalledTimes(1);
    input.remove();
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
