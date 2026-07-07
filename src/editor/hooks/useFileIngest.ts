import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type { Action, AppState } from '../store';
import { ingestFile, ingestImages, isImageFile, type IngestResult } from '../lib/ingest';
import type { LoadedDoc } from '../lib/pdfRender';

interface Args {
  dispatch: Dispatch<Action>;
  setDocs: Dispatch<SetStateAction<Map<string, LoadedDoc>>>;
  setAppState: (s: AppState) => void;
  showToast: (message: string, tone?: 'success' | 'error') => void;
  clearRestorable: () => void;
}

/**
 * Adding files to the session — from drag-drop, the hidden file input, or the
 * toolbar Add button. PDFs ingest one doc each; images batch into a single
 * generated doc. Unsupported types are silently ignored (dropping only a .txt
 * is a no-op, not an error).
 */
export function useFileIngest({
  dispatch,
  setDocs,
  setAppState,
  showToast,
  clearRestorable,
}: Args) {
  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const all = Array.from(files);
      const images = all.filter(isImageFile);
      const pdfs = all.filter(
        (f) => !isImageFile(f) && (!f.type || f.type === 'application/pdf'),
      );
      if (images.length === 0 && pdfs.length === 0) return;

      clearRestorable(); // starting fresh work supersedes any restore offer
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
    [dispatch, setDocs, setAppState, showToast, clearRestorable],
  );

  const pickFiles = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf,image/png,image/jpeg';
    input.multiple = true;
    input.onchange = () => {
      if (input.files?.length) addFiles(input.files);
    };
    input.click();
  }, [addFiles]);

  return { addFiles, pickFiles };
}
