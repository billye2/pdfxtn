import type { Dispatch, SetStateAction } from 'react';
import type { Action } from '../store';
import type { PageDescriptor } from '../lib/pageModel';
import type { LoadedDoc } from '../lib/pdfRender';
import type { useDialogs } from '../hooks/useDialogs';
import type { useExport } from '../hooks/useExport';
// Static imports on purpose — these were lazy() chunks once, but a Chrome
// extension auto-updates in place: an editor tab opened before the update can
// no longer fetch the old content-hashed chunk files, so the first dialog/
// preview open after an update threw "Failed to fetch dynamically imported
// module". The ~14 KB these add to the main bundle is read from disk anyway.
import CropDialog from './CropDialog';
import RangeDialog from './RangeDialog';
import MixDialog, { type MixGroup } from './MixDialog';
import SplitEveryDialog from './SplitEveryDialog';
import ImagesDialog from './ImagesDialog';
import Lightbox from './Lightbox';

interface Props {
  dialogs: ReturnType<typeof useDialogs>;
  pages: PageDescriptor[];
  docs: Map<string, LoadedDoc>;
  selected: ReadonlySet<string>;
  /** Clamped lightbox position, or null when the preview is closed. */
  previewPos: number | null;
  setPreviewIndex: Dispatch<SetStateAction<number | null>>;
  dispatch: Dispatch<Action>;
  showToast: (message: string, tone?: 'success' | 'error') => void;
  exportRange: ReturnType<typeof useExport>['exportRange'];
  exportImages: ReturnType<typeof useExport>['exportImages'];
}

/** All on-demand overlays: the five dialogs plus the lightbox. */
export default function EditorDialogs({
  dialogs,
  pages,
  docs,
  selected,
  previewPos,
  setPreviewIndex,
  dispatch,
  showToast,
  exportRange,
  exportImages,
}: Props) {
  // Group the current pages by their source document, preserving first-seen
  // order — the unit Mix interleaves over.
  function pageGroups(): MixGroup[] {
    const order: string[] = [];
    const byDoc = new Map<string, typeof pages>();
    for (const p of pages) {
      if (!byDoc.has(p.docId)) {
        byDoc.set(p.docId, []);
        order.push(p.docId);
      }
      byDoc.get(p.docId)!.push(p);
    }
    return order.map((docId) => ({
      docId,
      name: docs.get(docId)?.name ?? 'PDF',
      pages: byDoc.get(docId)!,
    }));
  }

  // Crop previews on the first selected page, else the first page.
  const cropRefPage = pages.find((p) => selected.has(p.id)) ?? pages[0];
  const cropRefDoc = cropRefPage ? docs.get(cropRefPage.docId) : undefined;

  return (
    <>
      {dialogs.isOpen('crop') && cropRefPage && cropRefDoc && (
        <CropDialog
          page={cropRefPage}
          doc={cropRefDoc}
          selectedCount={selected.size}
          onApply={(crop, scope) => {
            dispatch({ type: 'applyCrop', crop, scope });
            dialogs.closeDialog();
            showToast('Cropped your pages');
          }}
          onCancel={dialogs.closeDialog}
        />
      )}

      {dialogs.isOpen('range') && (
        <RangeDialog
          total={pages.length}
          onExport={(indices) => {
            dialogs.closeDialog();
            exportRange(indices);
          }}
          onCancel={dialogs.closeDialog}
        />
      )}

      {dialogs.isOpen('mix') && (
        <MixDialog
          groups={pageGroups()}
          pageCount={pages.length}
          onMix={(mixed) => {
            dispatch({ type: 'setPages', pages: mixed });
            dialogs.closeDialog();
            showToast('Mixed the pages');
          }}
          onUnmix={({ reverseSecond, markSplit }) => {
            dispatch({ type: 'unmix', reverseSecond, markSplit });
            dialogs.closeDialog();
            showToast(
              markSplit
                ? 'Un-mixed — click Save PDF to get two files'
                : 'Un-mixed the pages',
            );
          }}
          onCancel={dialogs.closeDialog}
        />
      )}

      {dialogs.isOpen('images') && (
        <ImagesDialog
          total={pages.length}
          selectedIndices={pages
            .map((p, i) => (selected.has(p.id) ? i : -1))
            .filter((i) => i >= 0)}
          onExport={(opts) => {
            dialogs.closeDialog();
            exportImages(opts);
          }}
          onCancel={dialogs.closeDialog}
        />
      )}

      {dialogs.isOpen('splitEvery') && (
        <SplitEveryDialog
          total={pages.length}
          onApply={(n) => {
            dispatch({ type: 'splitEveryN', n });
            dialogs.closeDialog();
            showToast(
              `Split every ${n} page${n === 1 ? '' : 's'} — click Save PDF to export`,
            );
          }}
          onCancel={dialogs.closeDialog}
        />
      )}

      {previewPos !== null && (
        <Lightbox
          page={pages[previewPos]}
          index={previewPos}
          total={pages.length}
          doc={docs.get(pages[previewPos].docId)}
          onPrev={() => setPreviewIndex((i) => (i === null ? i : Math.max(i - 1, 0)))}
          onNext={() =>
            setPreviewIndex((i) => (i === null ? i : Math.min(i + 1, pages.length - 1)))
          }
          onRotate={(delta) =>
            dispatch({ type: 'rotateOne', id: pages[previewPos].id, delta })
          }
          onDelete={() => {
            dispatch({
              type: 'toggleSelect',
              id: pages[previewPos].id,
              additive: false,
            });
            dispatch({ type: 'deleteSelected' });
          }}
          onCrop={() => {
            dispatch({
              type: 'toggleSelect',
              id: pages[previewPos].id,
              additive: false,
            });
            setPreviewIndex(null);
            dialogs.openDialog('crop');
          }}
          onClose={() => setPreviewIndex(null)}
        />
      )}
    </>
  );
}
