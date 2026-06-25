import { describe, it, expect, beforeEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { saveDocs, saveState, loadSession, clearSession } from './persist';
import type { PageDescriptor } from './pageModel';

// Fresh in-memory IndexedDB per test (persist.ts reads the global at call time).
beforeEach(() => {
  globalThis.indexedDB = new IDBFactory() as unknown as IDBFactory;
});

const mkPages = (n: number, docId = 'd1'): PageDescriptor[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    docId,
    pageIndex: i,
    rotation: 0,
  }));

const mkDoc = (id: string, name: string, bytes: number[]) => ({
  id,
  name,
  bytes: new Uint8Array(bytes),
});

describe('persist', () => {
  it('round-trips a saved session, bytes intact', async () => {
    await saveDocs([mkDoc('d1', 'a.pdf', [1, 2, 3, 4])]);
    await saveState({
      savedAt: 123,
      pages: mkPages(3),
      splitMarks: ['p1'],
      look: 'bubble',
    });

    const s = await loadSession();
    expect(s).not.toBeNull();
    expect(s!.state.pages.map((p) => p.id)).toEqual(['p0', 'p1', 'p2']);
    expect(s!.state.splitMarks).toEqual(['p1']);
    expect(s!.state.look).toBe('bubble');
    expect(s!.docs).toHaveLength(1);
    expect([...s!.docs[0].bytes]).toEqual([1, 2, 3, 4]);
  });

  it('returns null when nothing is saved', async () => {
    expect(await loadSession()).toBeNull();
  });

  it('returns null when the saved state has no pages', async () => {
    await saveState({ savedAt: 1, pages: [], splitMarks: [], look: 'blocks' });
    expect(await loadSession()).toBeNull();
  });

  it('returns null when a referenced doc is missing its bytes', async () => {
    // Pages reference d1, but d1's bytes were never saved — unrebuildable.
    await saveState({
      savedAt: 1,
      pages: mkPages(2, 'd1'),
      splitMarks: [],
      look: 'blocks',
    });
    expect(await loadSession()).toBeNull();
  });

  it('returns only the docs referenced by the saved pages', async () => {
    await saveDocs([mkDoc('d1', 'a', [1]), mkDoc('d2', 'b', [2])]);
    await saveState({
      savedAt: 1,
      pages: mkPages(1, 'd1'),
      splitMarks: [],
      look: 'blocks',
    });
    const s = await loadSession();
    expect(s!.docs.map((d) => d.id)).toEqual(['d1']);
  });

  it('saveState overwrites the previous session', async () => {
    await saveDocs([mkDoc('d1', 'a', [1])]);
    await saveState({
      savedAt: 1,
      pages: mkPages(3, 'd1'),
      splitMarks: [],
      look: 'blocks',
    });
    await saveState({
      savedAt: 2,
      pages: mkPages(1, 'd1'),
      splitMarks: [],
      look: 'sunny',
    });
    const s = await loadSession();
    expect(s!.state.pages).toHaveLength(1);
    expect(s!.state.look).toBe('sunny');
  });

  it('clearSession wipes both stores', async () => {
    await saveDocs([mkDoc('d1', 'a', [1])]);
    await saveState({
      savedAt: 1,
      pages: mkPages(1, 'd1'),
      splitMarks: [],
      look: 'blocks',
    });
    await clearSession();
    expect(await loadSession()).toBeNull();
  });
});
