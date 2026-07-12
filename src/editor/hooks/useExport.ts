import { useCallback, useState } from 'react';
import { boundariesFromMarks, splitAt, type PageDescriptor } from '../lib/pageModel';
import { exportGroups, exportSingle } from '../lib/pdfExport';
import { exportPagesAsImages, type ImageFormat } from '../lib/pdfImages';
import type { LoadedDoc } from '../lib/pdfRender';

interface Args {
  pages: PageDescriptor[];
  docs: Map<string, LoadedDoc>;
  splitMarks: Set<string>;
  showToast: (message: string, tone?: 'success' | 'error') => void;
}

/** Yield a frame so the saving UI (button, progress bar) can actually paint. */
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r(null)));

/**
 * Save/export flows for the current page list: full save (single file, or one
 * file per split group with progress), an arbitrary page range, and pages as
 * images. Each surfaces success/failure via the shared toast. Closing the
 * triggering dialog is left to the caller.
 */
export function useExport({ pages, docs, splitMarks, showToast }: Args) {
  const [saving, setSaving] = useState(false);
  // For multi-step exports (split parts, images) we can show real progress;
  // single-file saves are indeterminate.
  const [saveProgress, setSaveProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);

  const sourceName = useCallback(
    () => (docs.size ? [...docs.values()][0].name : 'document.pdf'),
    [docs],
  );

  const save = useCallback(async () => {
    if (saving) return; // guard against double-clicks
    setSaving(true);
    try {
      // Yield a frame so the saving UI paints before the (blocking) build.
      await nextFrame();
      if (splitMarks.size > 0) {
        const groups = splitAt(pages, boundariesFromMarks(pages, splitMarks));
        setSaveProgress({ done: 0, total: groups.length });
        await nextFrame();
        await exportGroups(groups, docs, sourceName(), async (done, total) => {
          setSaveProgress({ done, total });
          await nextFrame();
        });
        showToast(`Saved ${groups.length} files`);
      } else {
        await exportSingle(pages, docs, sourceName());
        showToast(`Saved ${sourceName().replace(/\.pdf$/i, '')}-edited.pdf`);
      }
    } catch (e) {
      showToast(`Save failed: ${(e as Error).message}`, 'error');
    } finally {
      setSaving(false);
      setSaveProgress(null);
    }
  }, [saving, splitMarks, pages, docs, sourceName, showToast]);

  const exportRange = useCallback(
    async (indices: number[]) => {
      if (saving) return;
      setSaving(true);
      try {
        await nextFrame();
        const subset = indices.map((i) => pages[i]).filter(Boolean);
        await exportSingle(subset, docs, sourceName());
        showToast(`Saved ${subset.length} page${subset.length === 1 ? '' : 's'}`);
      } catch (e) {
        showToast(`Export failed: ${(e as Error).message}`, 'error');
      } finally {
        setSaving(false);
      }
    },
    [saving, pages, docs, sourceName, showToast],
  );

  const exportImages = useCallback(
    async (opts: {
      format: ImageFormat;
      scale: number;
      indices: number[];
      zip?: boolean;
    }) => {
      if (saving) return;
      setSaving(true);
      try {
        const subset = opts.indices.map((i) => pages[i]).filter(Boolean);
        setSaveProgress({ done: 0, total: subset.length });
        await nextFrame();
        const n = await exportPagesAsImages(subset, docs, sourceName(), {
          format: opts.format,
          scale: opts.scale,
          zip: opts.zip,
          onProgress: async (done, total) => {
            setSaveProgress({ done, total });
            await nextFrame();
          },
        });
        showToast(
          opts.zip && n > 0
            ? `Saved ${n} image${n === 1 ? '' : 's'} as a .zip`
            : `Saved ${n} image${n === 1 ? '' : 's'}`,
        );
      } catch (e) {
        showToast(`Image export failed: ${(e as Error).message}`, 'error');
      } finally {
        setSaving(false);
        setSaveProgress(null);
      }
    },
    [saving, pages, docs, sourceName, showToast],
  );

  return { saving, saveProgress, save, exportRange, exportImages };
}
