// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePendingSource } from './usePendingSource';
import {
  consumePendingSource,
  ensureHostPermission,
  ingestUrl,
} from '../lib/ingest';

vi.mock('../lib/ingest', () => ({
  consumePendingSource: vi.fn(),
  ensureHostPermission: vi.fn(),
  ingestUrl: vi.fn(),
}));

function setup() {
  const dispatch = vi.fn();
  const setDocs = vi.fn();
  const setAppState = vi.fn();
  const showToast = vi.fn();
  const clearRestorable = vi.fn();
  const view = renderHook(() =>
    usePendingSource({ dispatch, setDocs, setAppState, showToast, clearRestorable }),
  );
  return { view, dispatch, setDocs, setAppState, showToast, clearRestorable };
}

beforeEach(() => {
  vi.mocked(consumePendingSource).mockReset().mockResolvedValue(null);
  vi.mocked(ensureHostPermission).mockReset().mockResolvedValue(true);
  vi.mocked(ingestUrl)
    .mockReset()
    .mockResolvedValue({
      doc: { id: 'd1', name: 'tab.pdf' },
      pages: [{ id: 'p0', docId: 'd1', pageIndex: 0, rotation: 0 }],
    } as never);
});

describe('usePendingSource', () => {
  it('stays hidden when no source was handed off', async () => {
    const { view } = setup();
    await waitFor(() => expect(consumePendingSource).toHaveBeenCalled());
    expect(view.result.current.pendingSource).toBeNull();
    expect(view.result.current.pendingHost).toBeNull();
  });

  it('exposes the handed-off URL and its hostname', async () => {
    vi.mocked(consumePendingSource).mockResolvedValue('https://example.com/a.pdf');
    const { view } = setup();
    await waitFor(() =>
      expect(view.result.current.pendingSource).toBe('https://example.com/a.pdf'),
    );
    expect(view.result.current.pendingHost).toBe('example.com');
  });

  it('loadPending ingests on granted permission and supersedes the restore offer', async () => {
    vi.mocked(consumePendingSource).mockResolvedValue('https://example.com/a.pdf');
    const { view, dispatch, setAppState, showToast, clearRestorable } = setup();
    await waitFor(() =>
      expect(view.result.current.pendingSource).not.toBeNull(),
    );

    await act(() => view.result.current.loadPending());

    expect(clearRestorable).toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'addPages' }),
    );
    expect(setAppState).toHaveBeenLastCalledWith('editor');
    expect(showToast).toHaveBeenCalledWith('Loaded 1 page');
    expect(view.result.current.pendingSource).toBeNull();
  });

  it('denied permission toasts and does not ingest', async () => {
    vi.mocked(consumePendingSource).mockResolvedValue('https://example.com/a.pdf');
    vi.mocked(ensureHostPermission).mockResolvedValue(false);
    const { view, showToast } = setup();
    await waitFor(() =>
      expect(view.result.current.pendingSource).not.toBeNull(),
    );

    await act(() => view.result.current.loadPending());

    expect(showToast).toHaveBeenCalledWith('Permission needed to load that PDF', 'error');
    expect(ingestUrl).not.toHaveBeenCalled();
  });

  it('a failed fetch toasts the error and returns to empty', async () => {
    vi.mocked(consumePendingSource).mockResolvedValue('https://example.com/a.pdf');
    vi.mocked(ingestUrl).mockRejectedValue(new Error('404'));
    const { view, setAppState, showToast } = setup();
    await waitFor(() =>
      expect(view.result.current.pendingSource).not.toBeNull(),
    );

    await act(() => view.result.current.loadPending());

    expect(showToast).toHaveBeenCalledWith('Could not load that PDF: 404', 'error');
    expect(setAppState).toHaveBeenLastCalledWith('empty');
  });
});
