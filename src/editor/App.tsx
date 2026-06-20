import { useCallback, useEffect, useReducer, useState } from 'react';
import Header from './components/Header';
import Toolbar from './components/Toolbar';
import ThumbnailGrid from './components/ThumbnailGrid';
import CropDialog from './components/CropDialog';
import RangeDialog from './components/RangeDialog';
import MixDialog, { type MixGroup } from './components/MixDialog';
import SplitEveryDialog from './components/SplitEveryDialog';
import ImagesDialog from './components/ImagesDialog';
import Lightbox from './components/Lightbox';
import EmptyState from './components/EmptyState';
import LoadingState from './components/LoadingState';
import SelectionDock from './components/SelectionDock';
import DragOverlay from './components/DragOverlay';
import Toast from './components/Toast';
import { initialHistory, reducer, type AppState } from './store';
import {
  consumePendingSource,
  ingestFile,
  ingestImages,
  ingestUrl,
  isImageFile,
  type IngestResult,
} from './lib/ingest';
import { boundariesFromMarks, splitAt } from './lib/pageModel';
import { exportGroups, exportSingle } from './lib/pdfExport';
import { exportPagesAsImages, type ImageFormat } from './lib/pdfImages';
import type { LoadedDoc } from './lib/pdfRender';
import { lookStyle, type LookId } from './themes';

interface ToastState {
  message: string;
  tone: 'success' | 'error';
}

export default function App() {
  const [history, dispatch] = useReducer(reducer, initialHistory);
  const [docs, setDocs] = useState<Map<string, LoadedDoc>>(new Map());
  const [appState, setAppState] = useState<AppState>('empty');
  const [look, setLook] = useState<LookId>('blocks');
  const [lookMenuOpen, setLookMenuOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [mixOpen, setMixOpen] = useState(false);
  const [splitEveryOpen, setSplitEveryOpen] = useState(false);
  const [imagesOpen, setImagesOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const { pages, selected, splitMarks } = history.present;
  const hasCrop = pages.some((p) => p.crop);

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
  const canMix = new Set(pages.map((p) => p.docId)).size >= 2;

  const showToast = useCallback((message: string, tone: 'success' | 'error' = 'success') => {
    setToast({ message, tone });
    setTimeout(() => setToast(null), 2700);
  }, []);

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const all = Array.from(files);
      const images = all.filter(isImageFile);
      const pdfs = all.filter(
        (f) => !isImageFile(f) && (!f.type || f.type === 'application/pdf'),
      );
      if (images.length === 0 && pdfs.length === 0) return;

      setAppState('loading');
      try {
        let added = 0;
        const ingest = (result: IngestResult) => {
          setDocs((prev) => new Map(prev).set(result.doc.id, result.doc));
          dispatch({ type: 'addPages', pages: result.pages });
          added += result.pages.length;
        };
        for (const file of pdfs) ingest(await ingestFile(file));
        if (images.length) ingest(await ingestImages(images));
        showToast(`Added ${added} page${added === 1 ? '' : 's'}`);
      } catch (e) {
        showToast(`Could not add files: ${(e as Error).message}`, 'error');
      } finally {
        setAppState('editor');
      }
    },
    [showToast],
  );

  // On first load, pull in the active tab's PDF if the worker handed one off.
  useEffect(() => {
    let done = false;
    (async () => {
      const url = await consumePendingSource();
      if (!url || done) return;
      setAppState('loading');
      try {
        const { doc, pages: newPages } = await ingestUrl(url);
        setDocs((prev) => new Map(prev).set(doc.id, doc));
        dispatch({ type: 'addPages', pages: newPages });
        setAppState('editor');
      } catch (e) {
        showToast(`Could not load the tab's PDF: ${(e as Error).message}`, 'error');
        setAppState('empty');
      }
    })();
    return () => {
      done = true;
    };
  }, [showToast]);

  // Keyboard shortcuts.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA';

      // While the preview is open, arrows page and Esc closes; nothing else runs.
      if (previewIndex !== null) {
        if (e.key === 'Escape') setPreviewIndex(null);
        else if (e.key === 'ArrowRight') setPreviewIndex((i) => (i === null ? i : Math.min(i + 1, pages.length - 1)));
        else if (e.key === 'ArrowLeft') setPreviewIndex((i) => (i === null ? i : Math.max(i - 1, 0)));
        return;
      }

      // Space opens the preview for a single selected page.
      if (e.key === ' ' && !typing && selected.size === 1) {
        e.preventDefault();
        const id = [...selected][0];
        const idx = pages.findIndex((p) => p.id === id);
        if (idx >= 0) setPreviewIndex(idx);
        return;
      }

      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? 'redo' : 'undo' });
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        dispatch({ type: 'redo' });
      } else if (mod && e.key.toLowerCase() === 'a' && !typing) {
        e.preventDefault();
        dispatch({ type: 'selectAll' });
      } else if (e.key === 'Escape') {
        dispatch({ type: 'clearSelection' });
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selected.size > 0 && !typing) {
        e.preventDefault();
        dispatch({ type: 'deleteSelected' });
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, previewIndex, pages]);

  // Keep the preview index valid as pages are deleted/extracted.
  useEffect(() => {
    if (previewIndex === null) return;
    if (pages.length === 0) setPreviewIndex(null);
    else if (previewIndex >= pages.length) setPreviewIndex(pages.length - 1);
  }, [pages.length, previewIndex]);

  const handleSelect = useCallback((id: string, e: React.MouseEvent) => {
    if (e.shiftKey) dispatch({ type: 'selectRangeTo', id });
    else dispatch({ type: 'toggleSelect', id, additive: e.metaKey || e.ctrlKey });
  }, []);

  function pickFiles() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf,image/png,image/jpeg';
    input.multiple = true;
    input.onchange = () => {
      if (input.files?.length) addFiles(input.files);
    };
    input.click();
  }

  function sourceName() {
    return docs.size ? [...docs.values()][0].name : 'document.pdf';
  }

  async function handleSave() {
    try {
      if (splitMarks.size > 0) {
        const groups = splitAt(pages, boundariesFromMarks(pages, splitMarks));
        await exportGroups(groups, docs, sourceName());
        showToast(`Saved ${groups.length} files`);
      } else {
        await exportSingle(pages, docs, sourceName());
        showToast(`Saved ${sourceName().replace(/\.pdf$/i, '')}-edited.pdf`);
      }
    } catch (e) {
      showToast(`Save failed: ${(e as Error).message}`, 'error');
    }
  }

  async function handleExportImages(opts: { format: ImageFormat; scale: number }) {
    setImagesOpen(false);
    try {
      const n = await exportPagesAsImages(pages, docs, sourceName(), opts);
      showToast(`Saved ${n} image${n === 1 ? '' : 's'}`);
    } catch (e) {
      showToast(`Image export failed: ${(e as Error).message}`, 'error');
    }
  }

  async function handleExportRange(indices: number[]) {
    setRangeOpen(false);
    try {
      const subset = indices.map((i) => pages[i]).filter(Boolean);
      await exportSingle(subset, docs, sourceName());
      showToast(`Saved ${subset.length} page${subset.length === 1 ? '' : 's'}`);
    } catch (e) {
      showToast(`Export failed: ${(e as Error).message}`, 'error');
    }
  }

  function applySplitToSelection() {
    pages.forEach((p) => {
      if (selected.has(p.id) && !splitMarks.has(p.id)) {
        dispatch({ type: 'toggleSplitMark', id: p.id });
      }
    });
    showToast('Added split marks');
  }

  const cropRefPage = pages.find((p) => selected.has(p.id)) ?? pages[0];
  const cropRefDoc = cropRefPage ? docs.get(cropRefPage.docId) : undefined;

  return (
    <div
      className="app"
      style={lookStyle(look)}
      data-look={look}
      onDragOver={(e) => {
        e.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={(e) => {
        if (e.relatedTarget === null) setDragActive(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragActive(false);
        if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
      }}
    >
      <Header
        appState={appState}
        pageCount={pages.length}
        selectedCount={selected.size}
        look={look}
        lookMenuOpen={lookMenuOpen}
        canSave={pages.length > 0}
        onToggleLookMenu={() => setLookMenuOpen((v) => !v)}
        onPickLook={(l) => {
          setLook(l);
          setLookMenuOpen(false);
        }}
        onCloseLookMenu={() => setLookMenuOpen(false)}
        onHelp={() => showToast('Tip: click pages to pick them, then rotate, crop, or split!')}
        onSave={handleSave}
      />

      {appState === 'editor' && (
        <Toolbar
          selectedCount={selected.size}
          hasCrop={hasCrop}
          canMix={canMix}
          canUndo={history.past.length > 0}
          canRedo={history.future.length > 0}
          onAddFiles={addFiles}
          onSelectAll={() => dispatch({ type: 'selectAll' })}
          onClearSelection={() => dispatch({ type: 'clearSelection' })}
          onRotateSelected={(delta) => dispatch({ type: 'rotateSelected', delta })}
          onDeleteSelected={() => dispatch({ type: 'deleteSelected' })}
          onOpenCrop={() => setCropOpen(true)}
          onSplit={applySplitToSelection}
          onOpenSplitEvery={() => setSplitEveryOpen(true)}
          onOpenMix={() => setMixOpen(true)}
          onClearCrop={() => dispatch({ type: 'applyCrop', crop: undefined, scope: 'all' })}
          onOpenRange={() => setRangeOpen(true)}
          onOpenImages={() => setImagesOpen(true)}
          onUndo={() => dispatch({ type: 'undo' })}
          onRedo={() => dispatch({ type: 'redo' })}
        />
      )}

      <main className="main">
        {appState === 'empty' && <EmptyState onPick={pickFiles} />}
        {appState === 'loading' && <LoadingState />}
        {appState === 'editor' && (
          <ThumbnailGrid
            pages={pages}
            docs={docs}
            selected={selected}
            splitMarks={splitMarks}
            onReorder={(from, to) => dispatch({ type: 'reorder', from, to })}
            onSelect={handleSelect}
            onRotate={(id, delta) => dispatch({ type: 'rotateOne', id, delta })}
            onDelete={(id) => {
              dispatch({ type: 'toggleSelect', id, additive: false });
              dispatch({ type: 'deleteSelected' });
            }}
            onToggleSplit={(id) => dispatch({ type: 'toggleSplitMark', id })}
            onOpenPreview={(id) => {
              const idx = pages.findIndex((p) => p.id === id);
              if (idx >= 0) setPreviewIndex(idx);
            }}
            onClearSelection={() => dispatch({ type: 'clearSelection' })}
          />
        )}
      </main>

      {appState === 'editor' && selected.size > 0 && (
        <SelectionDock
          count={selected.size}
          onRotate={(delta) => dispatch({ type: 'rotateSelected', delta })}
          onCrop={() => setCropOpen(true)}
          onExtract={() => {
            dispatch({ type: 'extractSelected' });
            showToast('Kept the picked pages');
          }}
          onDelete={() => dispatch({ type: 'deleteSelected' })}
          onClear={() => dispatch({ type: 'clearSelection' })}
        />
      )}

      {cropOpen && cropRefPage && cropRefDoc && (
        <CropDialog
          page={cropRefPage}
          doc={cropRefDoc}
          selectedCount={selected.size}
          onApply={(crop, scope) => {
            dispatch({ type: 'applyCrop', crop, scope });
            setCropOpen(false);
            showToast('Cropped your pages');
          }}
          onCancel={() => setCropOpen(false)}
        />
      )}

      {rangeOpen && (
        <RangeDialog
          total={pages.length}
          onExport={handleExportRange}
          onCancel={() => setRangeOpen(false)}
        />
      )}

      {mixOpen && (
        <MixDialog
          groups={pageGroups()}
          onMix={(mixed) => {
            dispatch({ type: 'setPages', pages: mixed });
            setMixOpen(false);
            showToast('Mixed the pages');
          }}
          onCancel={() => setMixOpen(false)}
        />
      )}

      {imagesOpen && (
        <ImagesDialog
          total={pages.length}
          onExport={handleExportImages}
          onCancel={() => setImagesOpen(false)}
        />
      )}

      {splitEveryOpen && (
        <SplitEveryDialog
          total={pages.length}
          onApply={(n) => {
            dispatch({ type: 'splitEveryN', n });
            setSplitEveryOpen(false);
            showToast(`Split every ${n} page${n === 1 ? '' : 's'} — click Save PDF to export`);
          }}
          onCancel={() => setSplitEveryOpen(false)}
        />
      )}

      {previewIndex !== null && pages[previewIndex] && (
        <Lightbox
          page={pages[previewIndex]}
          index={previewIndex}
          total={pages.length}
          doc={docs.get(pages[previewIndex].docId)}
          onPrev={() => setPreviewIndex((i) => (i === null ? i : Math.max(i - 1, 0)))}
          onNext={() =>
            setPreviewIndex((i) => (i === null ? i : Math.min(i + 1, pages.length - 1)))
          }
          onRotate={(delta) =>
            dispatch({ type: 'rotateOne', id: pages[previewIndex].id, delta })
          }
          onDelete={() => {
            dispatch({ type: 'toggleSelect', id: pages[previewIndex].id, additive: false });
            dispatch({ type: 'deleteSelected' });
          }}
          onCrop={() => {
            dispatch({ type: 'toggleSelect', id: pages[previewIndex].id, additive: false });
            setPreviewIndex(null);
            setCropOpen(true);
          }}
          onClose={() => setPreviewIndex(null)}
        />
      )}

      {dragActive && <DragOverlay />}
      {toast && <Toast message={toast.message} tone={toast.tone} />}
    </div>
  );
}
