import { useCallback, useEffect, useReducer, useState } from 'react';
import Header from './components/Header';
import Toolbar from './components/Toolbar';
import ThumbnailGrid from './components/ThumbnailGrid';
import CropDialog from './components/CropDialog';
import RangeDialog from './components/RangeDialog';
import EmptyState from './components/EmptyState';
import LoadingState from './components/LoadingState';
import SelectionDock from './components/SelectionDock';
import DragOverlay from './components/DragOverlay';
import Toast from './components/Toast';
import { initialHistory, reducer, type AppState } from './store';
import { consumePendingSource, ingestFile, ingestUrl } from './lib/ingest';
import { boundariesFromMarks, splitAt } from './lib/pageModel';
import { exportGroups, exportSingle } from './lib/pdfExport';
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
  const [dragActive, setDragActive] = useState(false);

  const { pages, selected, splitMarks } = history.present;
  const hasCrop = pages.some((p) => p.crop);

  const showToast = useCallback((message: string, tone: 'success' | 'error' = 'success') => {
    setToast({ message, tone });
    setTimeout(() => setToast(null), 2700);
  }, []);

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files).filter((f) => !f.type || f.type === 'application/pdf');
      if (list.length === 0) return;
      setAppState('loading');
      try {
        let added = 0;
        for (const file of list) {
          const { doc, pages: newPages } = await ingestFile(file);
          setDocs((prev) => new Map(prev).set(doc.id, doc));
          dispatch({ type: 'addPages', pages: newPages });
          added += newPages.length;
        }
        showToast(`Added ${added} page${added === 1 ? '' : 's'}`);
      } catch (e) {
        showToast(`Could not open PDF: ${(e as Error).message}`, 'error');
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
  }, [selected.size]);

  const handleSelect = useCallback((id: string, e: React.MouseEvent) => {
    if (e.shiftKey) dispatch({ type: 'selectRangeTo', id });
    else dispatch({ type: 'toggleSelect', id, additive: e.metaKey || e.ctrlKey });
  }, []);

  function pickFiles() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf';
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
          canUndo={history.past.length > 0}
          canRedo={history.future.length > 0}
          onAddFiles={addFiles}
          onSelectAll={() => dispatch({ type: 'selectAll' })}
          onClearSelection={() => dispatch({ type: 'clearSelection' })}
          onRotateSelected={(delta) => dispatch({ type: 'rotateSelected', delta })}
          onDeleteSelected={() => dispatch({ type: 'deleteSelected' })}
          onOpenCrop={() => setCropOpen(true)}
          onSplit={applySplitToSelection}
          onClearCrop={() => dispatch({ type: 'applyCrop', crop: undefined, scope: 'all' })}
          onOpenRange={() => setRangeOpen(true)}
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

      {dragActive && <DragOverlay />}
      {toast && <Toast message={toast.message} tone={toast.tone} />}
    </div>
  );
}
