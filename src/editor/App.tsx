import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from 'react';
import Header from './components/Header';
import Toolbar from './components/Toolbar';
import ThumbnailGrid from './components/ThumbnailGrid';
import type { MixGroup } from './components/MixDialog';
import EmptyState from './components/EmptyState';
import LoadingState from './components/LoadingState';
import SelectionDock from './components/SelectionDock';
import DragOverlay from './components/DragOverlay';
import Toast from './components/Toast';
import { initialHistory, reducer, type AppState } from './store';
import {
  consumePendingSource,
  ensureHostPermission,
  ingestFile,
  ingestImages,
  ingestUrl,
  isImageFile,
  type IngestResult,
} from './lib/ingest';
import { loadDoc, type LoadedDoc } from './lib/pdfRender';
import { clearSession, loadSession, type RestoredSession } from './lib/persist';
import { lookStyle, type LookId } from './themes';
import { useToast } from './hooks/useToast';
import { useDialogs } from './hooks/useDialogs';
import { useExport } from './hooks/useExport';
import { useAutosave } from './hooks/useAutosave';

// Modals and the lightbox are only ever shown on demand, so they load in their
// own chunks — this keeps the initial editor bundle lean (see the Suspense wrap
// around their render below).
const CropDialog = lazy(() => import('./components/CropDialog'));
const RangeDialog = lazy(() => import('./components/RangeDialog'));
const MixDialog = lazy(() => import('./components/MixDialog'));
const SplitEveryDialog = lazy(() => import('./components/SplitEveryDialog'));
const ImagesDialog = lazy(() => import('./components/ImagesDialog'));
const Lightbox = lazy(() => import('./components/Lightbox'));

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
  const [look, setLook] = useState<LookId>('blocks');
  const [lookMenuOpen, setLookMenuOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [pendingSource, setPendingSource] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [restorable, setRestorable] = useState<RestoredSession | null>(null);
  const [liveMsg, setLiveMsg] = useState(''); // screen-reader announcements
  const tipIndex = useRef(0);

  const { pages, selected, splitMarks } = history.present;
  const hasCrop = pages.some((p) => p.crop);

  const { toast, showToast } = useToast();
  const dialogs = useDialogs();
  const { saving, saveProgress, save, exportRange, exportImages } = useExport({
    pages,
    docs,
    splitMarks,
    showToast,
  });

  useAutosave({ pages, splitMarks, docs, look, active: appState === 'editor' });

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

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const all = Array.from(files);
      const images = all.filter(isImageFile);
      const pdfs = all.filter(
        (f) => !isImageFile(f) && (!f.type || f.type === 'application/pdf'),
      );
      if (images.length === 0 && pdfs.length === 0) return;

      setRestorable(null); // starting fresh work supersedes any restore offer
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

  // On first load, note the active tab's PDF (if handed off) and offer to load
  // it. We don't fetch automatically: fetching needs host access, which we only
  // request on an explicit user click (see loadPending).
  useEffect(() => {
    let done = false;
    (async () => {
      const url = await consumePendingSource();
      if (url && !done) setPendingSource(url);
    })();
    return () => {
      done = true;
    };
  }, []);

  // On first load, look for an autosaved session and offer to restore it.
  useEffect(() => {
    let done = false;
    loadSession()
      .then((session) => {
        if (session && !done) setRestorable(session);
      })
      .catch(() => {});
    return () => {
      done = true;
    };
  }, []);

  // Rebuild the saved session: re-parse each stored PDF, then load the pages.
  async function restoreSession() {
    const session = restorable;
    if (!session) return;
    setRestorable(null);
    setAppState('loading');
    try {
      const map = new Map<string, LoadedDoc>();
      for (const d of session.docs) map.set(d.id, await loadDoc(d.id, d.name, d.bytes));
      setDocs(map);
      dispatch({
        type: 'restore',
        pages: session.state.pages,
        splitMarks: session.state.splitMarks,
      });
      setLook(session.state.look as LookId);
      setAppState('editor');
      showToast(`Restored ${session.state.pages.length} pages`);
    } catch (e) {
      showToast(`Could not restore: ${(e as Error).message}`, 'error');
      setAppState('empty');
    }
  }

  function discardSession() {
    setRestorable(null);
    clearSession().catch(() => {});
  }

  // User clicked "Load PDF" in the banner — request that origin's host
  // permission (within this gesture), then fetch and ingest.
  async function loadPending() {
    const url = pendingSource;
    if (!url) return;
    setRestorable(null);
    const granted = await ensureHostPermission(url);
    setPendingSource(null);
    if (!granted) {
      showToast('Permission needed to load that PDF', 'error');
      return;
    }
    setAppState('loading');
    try {
      const { doc, pages: newPages } = await ingestUrl(url);
      setDocs((prev) => new Map(prev).set(doc.id, doc));
      dispatch({ type: 'addPages', pages: newPages });
      setAppState('editor');
      showToast(`Loaded ${newPages.length} page${newPages.length === 1 ? '' : 's'}`);
    } catch (e) {
      showToast(`Could not load that PDF: ${(e as Error).message}`, 'error');
      setAppState('empty');
    }
  }

  function hostOf(url: string): string {
    try {
      return new URL(url).hostname || 'this tab';
    } catch {
      return 'this tab';
    }
  }

  // Keyboard shortcuts.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA';

      // While the preview is open, arrows page and Esc/Space close; nothing
      // else runs. (Space toggles: it opened the preview, so it also closes it.)
      if (previewIndex !== null) {
        if (e.key === 'Escape') setPreviewIndex(null);
        else if (e.key === ' ') {
          e.preventDefault();
          setPreviewIndex(null);
        } else if (e.key === 'ArrowRight')
          setPreviewIndex((i) => (i === null ? i : Math.min(i + 1, pages.length - 1)));
        else if (e.key === 'ArrowLeft')
          setPreviewIndex((i) => (i === null ? i : Math.max(i - 1, 0)));
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

      // Left/Right nudge the single selected page one position — a modeless
      // keyboard alternative to dragging.
      if (
        (e.key === 'ArrowLeft' || e.key === 'ArrowRight') &&
        !typing &&
        selected.size === 1
      ) {
        const id = [...selected][0];
        const from = pages.findIndex((p) => p.id === id);
        const to = e.key === 'ArrowLeft' ? from - 1 : from + 1;
        if (from < 0 || to < 0 || to >= pages.length) return; // at an edge
        e.preventDefault();
        dispatch({ type: 'reorder', from, to });
        setLiveMsg(`Moved page to position ${to + 1} of ${pages.length}.`);
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
      } else if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        selected.size > 0 &&
        !typing
      ) {
        e.preventDefault();
        dispatch({ type: 'deleteSelected' });
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, previewIndex, pages]);

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

      {restorable && appState !== 'editor' && (
        <div className="pending-banner restore-banner">
          <span className="pending-text">
            Restore your previous work?{' '}
            <strong>
              {restorable.state.pages.length} page
              {restorable.state.pages.length === 1 ? '' : 's'}
            </strong>{' '}
            from your last session.
          </span>
          <button className="btn-go pending-btn" onClick={restoreSession}>
            Restore
          </button>
          <button className="btn-secondary pending-btn" onClick={discardSession}>
            Discard
          </button>
        </div>
      )}

      {pendingSource && (
        <div className="pending-banner">
          <span className="pending-text">
            A PDF from <strong>{hostOf(pendingSource)}</strong> is ready to load.
          </span>
          <button className="btn-go pending-btn" onClick={loadPending}>
            Load PDF
          </button>
          <button
            className="btn-secondary pending-btn"
            onClick={() => setPendingSource(null)}
          >
            Dismiss
          </button>
        </div>
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
          onCrop={() => dialogs.openDialog('crop')}
          onExtract={() => {
            dispatch({ type: 'extractSelected' });
            showToast('Kept the picked pages');
          }}
          onDelete={() => dispatch({ type: 'deleteSelected' })}
          onClear={() => dispatch({ type: 'clearSelection' })}
        />
      )}

      <Suspense fallback={null}>
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
            onMix={(mixed) => {
              dispatch({ type: 'setPages', pages: mixed });
              dialogs.closeDialog();
              showToast('Mixed the pages');
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
      </Suspense>

      {dragActive && <DragOverlay />}
      {toast && <Toast message={toast.message} tone={toast.tone} />}

      <div className="sr-only" aria-live="polite" role="status">
        {liveMsg}
      </div>
    </div>
  );
}
