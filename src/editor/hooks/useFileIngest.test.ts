// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFileIngest } from './useFileIngest';
import { ingestFile, ingestImages, isImageFile } from '../lib/ingest';

vi.mock('../lib/ingest', () => ({
  ingestFile: vi.fn(),
  ingestImages: vi.fn(),
  isImageFile: vi.fn(),
}));

const file = (name: string, type: string) => new File(['x'], name, { type });

function setup() {
  const dispatch = vi.fn();
  const setDocs = vi.fn();
  const setAppState = vi.fn();
  const showToast = vi.fn();
  const clearRestorable = vi.fn();
  const view = renderHook(() =>
    useFileIngest({ dispatch, setDocs, setAppState, showToast, clearRestorable }),
  );
  return { view, dispatch, setDocs, setAppState, showToast, clearRestorable };
}

beforeEach(() => {
  vi.mocked(isImageFile)
    .mockReset()
    .mockImplementation((f) => f.type.startsWith('image/'));
  vi.mocked(ingestFile)
    .mockReset()
    .mockResolvedValue({
      doc: { id: 'd1', name: 'a.pdf' },
      pages: [
        { id: 'p0', docId: 'd1', pageIndex: 0, rotation: 0 },
        { id: 'p1', docId: 'd1', pageIndex: 1, rotation: 0 },
      ],
    } as never);
  vi.mocked(ingestImages)
    .mockReset()
    .mockResolvedValue({
      doc: { id: 'imgs', name: 'images.pdf' },
      pages: [{ id: 'q0', docId: 'imgs', pageIndex: 0, rotation: 0 }],
    } as never);
});

describe('useFileIngest', () => {
  it('unsupported files alone are a silent no-op', async () => {
    const { view, setAppState, showToast, clearRestorable } = setup();
    await act(() => view.result.current.addFiles([file('note.txt', 'text/plain')]));
    expect(setAppState).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
    expect(clearRestorable).not.toHaveBeenCalled();
  });

  it('PDFs and images ingest together, toast the page total, supersede restore', async () => {
    const { view, dispatch, setAppState, showToast, clearRestorable } = setup();
    await act(() =>
      view.result.current.addFiles([
        file('a.pdf', 'application/pdf'),
        file('pic.png', 'image/png'),
        file('skip.txt', 'text/plain'),
      ]),
    );
    expect(clearRestorable).toHaveBeenCalled();
    expect(ingestFile).toHaveBeenCalledTimes(1);
    expect(ingestImages).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledTimes(2); // one addPages per ingest
    expect(showToast).toHaveBeenCalledWith('Added 3 pages');
    expect(setAppState).toHaveBeenLastCalledWith('editor');
  });

  it('an ingest failure toasts the error but still lands in the editor', async () => {
    vi.mocked(ingestFile).mockRejectedValue(new Error('encrypted'));
    const { view, setAppState, showToast } = setup();
    await act(() => view.result.current.addFiles([file('a.pdf', 'application/pdf')]));
    expect(showToast).toHaveBeenCalledWith('Could not add files: encrypted', 'error');
    expect(setAppState).toHaveBeenLastCalledWith('editor');
  });
});
