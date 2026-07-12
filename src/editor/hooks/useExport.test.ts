// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useExport } from './useExport';
import type { PageDescriptor } from '../lib/pageModel';
import type { LoadedDoc } from '../lib/pdfRender';
import { exportSingle, exportGroups } from '../lib/pdfExport';
import { exportPagesAsImages } from '../lib/pdfImages';

// Mock only the side-effecting export libs; the pure pageModel split helpers run for real.
vi.mock('../lib/pdfExport', () => ({
  exportSingle: vi.fn(),
  exportGroups: vi.fn(),
}));
vi.mock('../lib/pdfImages', () => ({
  exportPagesAsImages: vi.fn(),
}));

const mkPages = (n: number): PageDescriptor[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    docId: 'd1',
    pageIndex: i,
    rotation: 0,
  }));

const docsWith = (name: string) =>
  new Map([['d1', { name }]]) as unknown as Map<string, LoadedDoc>;

function setup(over: Partial<Parameters<typeof useExport>[0]> = {}) {
  const showToast = vi.fn();
  const args = {
    pages: mkPages(4),
    docs: docsWith('mydoc.pdf'),
    splitMarks: new Set<string>(),
    showToast,
    ...over,
  };
  const { result } = renderHook(() => useExport(args));
  return { result, showToast };
}

beforeEach(() => {
  vi.mocked(exportSingle).mockReset().mockResolvedValue(undefined);
  vi.mocked(exportGroups).mockReset().mockResolvedValue(undefined);
  vi.mocked(exportPagesAsImages).mockReset().mockResolvedValue(0);
});

describe('useExport', () => {
  it('save() with no split marks exports a single file and toasts the name', async () => {
    const { result, showToast } = setup();
    await act(async () => result.current.save());
    expect(exportSingle).toHaveBeenCalledOnce();
    expect(exportGroups).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('Saved mydoc-edited.pdf');
  });

  it('save() with split marks exports groups and toasts the file count', async () => {
    const { result, showToast } = setup({ splitMarks: new Set(['p1']) });
    await act(async () => result.current.save());
    expect(exportGroups).toHaveBeenCalledOnce();
    expect(exportSingle).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(expect.stringMatching(/^Saved \d+ files$/));
  });

  it('exportRange() exports just the chosen pages and toasts the count', async () => {
    const { result, showToast } = setup();
    await act(async () => result.current.exportRange([0, 2]));
    const subset = vi.mocked(exportSingle).mock.calls[0][0];
    expect(subset.map((p) => p.id)).toEqual(['p0', 'p2']);
    expect(showToast).toHaveBeenCalledWith('Saved 2 pages');
  });

  it('exportImages() toasts the number of images written', async () => {
    vi.mocked(exportPagesAsImages).mockResolvedValue(3);
    const { result, showToast } = setup();
    await act(async () =>
      result.current.exportImages({ format: 'png', scale: 2, indices: [0, 1, 2] }),
    );
    expect(showToast).toHaveBeenCalledWith('Saved 3 images');
  });

  it('exportImages() forwards the zip option and toasts the .zip variant', async () => {
    vi.mocked(exportPagesAsImages).mockResolvedValue(3);
    const { result, showToast } = setup();
    await act(async () =>
      result.current.exportImages({
        format: 'png',
        scale: 2,
        indices: [0, 1, 2],
        zip: true,
      }),
    );
    expect(vi.mocked(exportPagesAsImages).mock.calls[0][3]).toMatchObject({ zip: true });
    expect(showToast).toHaveBeenCalledWith('Saved 3 images as a .zip');
  });

  it('exportImages() drives progress through an awaited onProgress callback', async () => {
    const seen: Array<[number, number]> = [];
    vi.mocked(exportPagesAsImages).mockImplementation(
      async (_pages, _docs, _name, opts) => {
        await opts.onProgress?.(1, 2);
        seen.push([1, 2]);
        await opts.onProgress?.(2, 2);
        seen.push([2, 2]);
        return 2;
      },
    );
    const { result } = setup();
    await act(async () =>
      result.current.exportImages({ format: 'png', scale: 2, indices: [0, 1] }),
    );
    expect(seen).toEqual([
      [1, 2],
      [2, 2],
    ]);
    // Progress state is cleaned up once the export settles.
    expect(result.current.saving).toBe(false);
    expect(result.current.saveProgress).toBeNull();
  });

  it('ignores overlapping exports while a save is already running', async () => {
    let release!: (v?: unknown) => void;
    vi.mocked(exportSingle).mockImplementationOnce(
      () =>
        new Promise((r) => {
          release = r;
        }) as Promise<void>,
    );
    const { result } = setup();
    let savePromise!: Promise<void>;
    await act(async () => {
      savePromise = result.current.save();
      // save() yields a paint frame before exporting — wait until it's really in flight.
      await vi.waitFor(() => expect(exportSingle).toHaveBeenCalledOnce());
    });
    expect(result.current.saving).toBe(true);
    await act(async () => result.current.exportRange([0]));
    await act(async () => {
      release();
      await savePromise;
    });
    // Only the original save reached the export lib; the range call was ignored.
    expect(exportSingle).toHaveBeenCalledTimes(1);
    expect(result.current.saving).toBe(false);
  });

  it('surfaces export failures as an error toast', async () => {
    vi.mocked(exportSingle).mockRejectedValue(new Error('disk full'));
    const { result, showToast } = setup();
    await act(async () => result.current.save());
    expect(showToast).toHaveBeenCalledWith('Save failed: disk full', 'error');
  });

  it('falls back to document.pdf when there are no docs', async () => {
    const { result } = setup({ docs: new Map() });
    await act(async () => result.current.exportRange([0]));
    expect(exportSingle).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'document.pdf',
    );
  });
});
