import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import Header from './components/Header';
import Toolbar from './components/Toolbar';
import ThumbnailGrid from './components/ThumbnailGrid';
import EmptyState from './components/EmptyState';
import LoadingState from './components/LoadingState';
import SelectionDock from './components/SelectionDock';
import DragOverlay from './components/DragOverlay';
import Toast from './components/Toast';
import Banners from './components/Banners';
import EditorDialogs from './components/EditorDialogs';
import { initialHistory, reducer, type AppState } from './store';
import type { LoadedDoc } from './lib/pdfRender';
import { lookStyle, loadSavedLook, saveLook, type LookId } from './themes';
import { useToast } from './hooks/useToast';
import { useDialogs } from './hooks/useDialogs';
import { useExport } from './hooks/useExport';
import { useAutosave } from './hooks/useAutosave';
import { useSessionRestore } from './hooks/useSessionRestore';
import { usePendingSource } from './hooks/usePendingSource';
import { useFileIngest } from './hooks/useFileIngest';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

// Rotating single-line tips shown by the header "?" button — one per click.
const HELP_TIPS = [
  'Tip: drag any page to reorder — grab anywhere on the card, not just the edge.',
  'Tip: select a page and tap ← or → to nudge it one spot without dragging.',
  'Tip: Shift-click to pick a range; Cmd/Ctrl-click to add or remove one page.',
  'Tip: double-click a page, tap the magnifier, or press Space to preview it large — scroll to see the rest.',
  'Tip: on a touch screen, press and hold a page to peek at it while you reorder.',
  'Tip: use Mix to interleave two PDFs — perfect for double-sided scans.',
  'Tip: Split every N pages, then Save to get one file per chunk.',
  'Tip: drop JPG or PNG files right in — they become PDF pages instantly.',
  'Tip: Export images as PNG or JPG (up to 3×) — bundle them into one .zip in a click.',
  'Tip: crop one region and apply it to all pages or just the selected ones.',
  'Tip: pick some pages, then "Keep these" to extract only those.',
  'Tip: Cmd/Ctrl+Z undoes, Cmd/Ctrl+A selects all, Esc clears your selection.',
  'Tip: add another PDF anytime to merge — its pages just append.',
  'Tip: right-click a PDF link on the web → "Open link in PDF Mana".',
  'Tip: open a PDF in a tab, then click the toolbar icon to load it automatically.',
  'Tip: page labels keep their original number even after you reorder pages.',
  'Tip: your work autosaves — if the tab reloads, click "Restore" to pick up where you left off.',
  'Tip: switch the Look in the top-right to recolor the whole app.',
];

export default function App() {
  const [history, dispatch] = useReducer(reducer, initialHistory);
  const [docs, setDocs] = useState<Map<string, LoadedDoc>>(new Map());
  const [appState, setAppState] = useState<AppState>('empty');
  const [look, setLook] = useState<LookId>(loadSavedLook);
  const [lookMenuOpen, setLookMenuOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const tipIndex = useRef(0);

  const { pages, selected, splitMarks } = history.present;
  const hasCrop = pages.some((p) => p.crop);
  const canMix = new Set(pages.map((p) => p.docId)).size >= 2;

  const { toast, showToast } = useToast();
  const dialogs = useDialogs();
  const { saving, saveProgress, save, exportRange, exportImages } = useExport({
    pages,
    docs,
    splitMarks,
    showToast,
  });

  useAutosave({ pages, splitMarks, docs, look, active: appState === 'editor' });

  // The look is a standalone preference: remember it across sessions, with or
  // without a document loaded (the autosave above only runs in the editor).
  useEffect(() => saveLook(look), [look]);

  const { restorable, clearRestorable, restoreSession, discardSession } =
    useSessionRestore({ dispatch, setDocs, setLook, setAppState, showToast });

  const { pendingHost, loadPending, dismiss: dismissPending } = usePendingSource({
    dispatch,
    setDocs,
    setAppState,
    showToast,
    clearRestorable,
  });

  const { addFiles, pickFiles } = useFileIngest({
    dispatch,
    setDocs,
    setAppState,
    showToast,
    clearRestorable,
  });

  const { liveMsg } = useKeyboardShortcuts({
    pages,
    selected,
    previewIndex,
    setPreviewIndex,
    dispatch,
  });

  // Warn before leaving/reloading while there's work in progress. (Can't help
  // a browser crash, but this catches accidental reloads, Cmd-W, and navigation.)
  useEffect(() => {
    if (pages.length === 0) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [pages.length]);

  // Keep the preview valid as pages are deleted/extracted by clamping at render
  // time instead of syncing state in an effect: if the previewed page is gone,
  // fall back to the last page (or close the preview when nothing is left).
  const previewPos =
    previewIndex === null || pages.length === 0
      ? null
      : Math.min(previewIndex, pages.length - 1);

  const handleSelect = useCallback((id: string, e: React.MouseEvent) => {
    if (e.shiftKey) dispatch({ type: 'selectRangeTo', id });
    else dispatch({ type: 'toggleSelect', id, additive: e.metaKey || e.ctrlKey });
  }, []);

  function applySplitToSelection() {
    pages.forEach((p) => {
      if (selected.has(p.id) && !splitMarks.has(p.id)) {
        dispatch({ type: 'toggleSplitMark', id: p.id });
      }
    });
    showToast('Added split marks');
  }

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
      {saving && (
        <div className="save-bar">
          <div
            className={`save-bar-fill${saveProgress ? '' : ' indeterminate'}`}
            style={
              saveProgress
                ? { width: `${(saveProgress.done / saveProgress.total) * 100}%` }
                : undefined
            }
          />
        </div>
      )}

      <Header
        appState={appState}
        pageCount={pages.length}
        selectedCount={selected.size}
        look={look}
        lookMenuOpen={lookMenuOpen}
        canSave={pages.length > 0}
        saving={saving}
        onToggleLookMenu={() => setLookMenuOpen((v) => !v)}
        onPickLook={(l) => {
          setLook(l);
          setLookMenuOpen(false);
        }}
        onCloseLookMenu={() => setLookMenuOpen(false)}
        onHelp={() => {
          showToast(HELP_TIPS[tipIndex.current]);
          tipIndex.current = (tipIndex.current + 1) % HELP_TIPS.length;
        }}
        onSave={save}
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
          onOpenCrop={() => dialogs.openDialog('crop')}
          onSplit={applySplitToSelection}
          onOpenSplitEvery={() => dialogs.openDialog('splitEvery')}
          onOpenMix={() => dialogs.openDialog('mix')}
          onClearCrop={() =>
            dispatch({ type: 'applyCrop', crop: undefined, scope: 'all' })
          }
          onOpenRange={() => dialogs.openDialog('range')}
          onOpenImages={() => dialogs.openDialog('images')}
          onUndo={() => dispatch({ type: 'undo' })}
          onRedo={() => dispatch({ type: 'redo' })}
        />
      )}

      <Banners
        restoreCount={
          restorable && appState !== 'editor' ? restorable.state.pages.length : null
        }
        onRestore={restoreSession}
        onDiscard={discardSession}
        pendingHost={pendingHost}
        onLoadPending={loadPending}
        onDismissPending={dismissPending}
      />

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
          onCrop={() => dialogs.openDialog('crop')}
          onExtract={() => {
            dispatch({ type: 'extractSelected' });
            showToast('Kept the picked pages');
          }}
          onDelete={() => dispatch({ type: 'deleteSelected' })}
          onClear={() => dispatch({ type: 'clearSelection' })}
        />
      )}

      <EditorDialogs
        dialogs={dialogs}
        pages={pages}
        docs={docs}
        selected={selected}
        previewPos={previewPos}
        setPreviewIndex={setPreviewIndex}
        dispatch={dispatch}
        showToast={showToast}
        exportRange={exportRange}
        exportImages={exportImages}
      />

      {dragActive && <DragOverlay />}
      {toast && <Toast message={toast.message} tone={toast.tone} />}

      <div className="sr-only" aria-live="polite" role="status">
        {liveMsg}
      </div>
    </div>
  );
}
