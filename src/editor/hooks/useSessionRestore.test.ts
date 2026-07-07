// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSessionRestore } from './useSessionRestore';
import { loadSession, clearSession } from '../lib/persist';
import { loadDoc } from '../lib/pdfRender';
import type { RestoredSession } from '../lib/persist';

vi.mock('../lib/persist', () => ({
  loadSession: vi.fn(),
  clearSession: vi.fn(),
}));
vi.mock('../lib/pdfRender', () => ({
  loadDoc: vi.fn(),
}));

const SESSION: RestoredSession = {
  state: {
    savedAt: 1,
    pages: [{ id: 'p0', docId: 'd1', pageIndex: 0, rotation: 0 }],
    splitMarks: [],
    look: 'midnight',
  },
  docs: [{ id: 'd1', name: 'a.pdf', bytes: new Uint8Array([1]) }],
} as unknown as RestoredSession;

function setup() {
  const dispatch = vi.fn();
  const setDocs = vi.fn();
  const setLook = vi.fn();
  const setAppState = vi.fn();
  const showToast = vi.fn();
  const view = renderHook(() =>
    useSessionRestore({ dispatch, setDocs, setLook, setAppState, showToast }),
  );
  return { view, dispatch, setDocs, setLook, setAppState, showToast };
}

beforeEach(() => {
  vi.mocked(loadSession).mockReset().mockResolvedValue(null);
  vi.mocked(clearSession).mockReset().mockResolvedValue(undefined);
  vi.mocked(loadDoc)
    .mockReset()
    .mockImplementation(async (id, name) => ({ id, name }) as never);
});

describe('useSessionRestore', () => {
  it('offers nothing when no session is saved', async () => {
    const { view } = setup();
    await waitFor(() => expect(loadSession).toHaveBeenCalled());
    expect(view.result.current.restorable).toBeNull();
  });

  it('surfaces a saved session as restorable', async () => {
    vi.mocked(loadSession).mockResolvedValue(SESSION);
    const { view } = setup();
    await waitFor(() => expect(view.result.current.restorable).toBe(SESSION));
  });

  it('restoreSession rehydrates docs, pages, look, and toasts', async () => {
    vi.mocked(loadSession).mockResolvedValue(SESSION);
    const { view, dispatch, setDocs, setLook, setAppState, showToast } = setup();
    await waitFor(() => expect(view.result.current.restorable).toBe(SESSION));

    await act(() => view.result.current.restoreSession());

    expect(setDocs).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: 'restore',
      pages: SESSION.state.pages,
      splitMarks: SESSION.state.splitMarks,
    });
    expect(setLook).toHaveBeenCalledWith('midnight');
    expect(setAppState).toHaveBeenLastCalledWith('editor');
    expect(showToast).toHaveBeenCalledWith('Restored 1 pages');
    expect(view.result.current.restorable).toBeNull();
  });

  it('a failed restore toasts the error and returns to empty', async () => {
    vi.mocked(loadSession).mockResolvedValue(SESSION);
    vi.mocked(loadDoc).mockRejectedValue(new Error('corrupt'));
    const { view, setAppState, showToast } = setup();
    await waitFor(() => expect(view.result.current.restorable).toBe(SESSION));

    await act(() => view.result.current.restoreSession());

    expect(showToast).toHaveBeenCalledWith('Could not restore: corrupt', 'error');
    expect(setAppState).toHaveBeenLastCalledWith('empty');
  });

  it('discardSession waits for the IndexedDB clear before dismissing', async () => {
    vi.mocked(loadSession).mockResolvedValue(SESSION);
    let resolveClear!: () => void;
    vi.mocked(clearSession).mockReturnValue(
      new Promise<void>((res) => {
        resolveClear = res;
      }),
    );
    const { view } = setup();
    await waitFor(() => expect(view.result.current.restorable).toBe(SESSION));

    let done = false;
    let discardPromise!: Promise<void>;
    act(() => {
      discardPromise = view.result.current.discardSession().then(() => {
        done = true;
      });
    });
    // Still offered while the clear is in flight.
    expect(done).toBe(false);
    expect(view.result.current.restorable).toBe(SESSION);

    resolveClear();
    await act(() => discardPromise);
    expect(view.result.current.restorable).toBeNull();
  });
});
