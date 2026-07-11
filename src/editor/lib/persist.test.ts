import { describe, it, expect, beforeEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import {
  saveDocs,
  saveState,
  loadSession,
  clearSession,
  saveRecent,
  loadRecents,
  getRecentBytes,
  removeRecent,
  clearRecents,
  setRecentPinned,
  RECENTS_MAX_COUNT,
  RECENTS_MAX_BYTES,
  type RecentMeta,
} from './persist';
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
      look: 'sticker',
    });
    const s = await loadSession();
    expect(s!.state.pages).toHaveLength(1);
    expect(s!.state.look).toBe('sticker');
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

const mkRecent = (
  hash: string,
  openedAt: number,
  bytes: Uint8Array = new Uint8Array([1, 2, 3]),
  extra: Partial<RecentMeta> = {},
): [RecentMeta, Uint8Array] => [
  {
    hash,
    name: `${hash}.pdf`,
    size: bytes.length,
    pageCount: 1,
    openedAt,
    ...extra,
  },
  bytes,
];

describe('recents', () => {
  it('round-trips meta and bytes, newest first', async () => {
    await saveRecent(...mkRecent('a', 100, new Uint8Array([1]), { thumb: 'data:x' }));
    await saveRecent(...mkRecent('b', 200, new Uint8Array([2, 3])));

    const recents = await loadRecents();
    expect(recents.map((r) => r.hash)).toEqual(['b', 'a']);
    expect(recents[1]).toMatchObject({
      name: 'a.pdf',
      size: 1,
      pageCount: 1,
      thumb: 'data:x',
    });
    expect([...(await getRecentBytes('b'))!]).toEqual([2, 3]);
  });

  it('reopening the same file updates it in place, no duplicate', async () => {
    await saveRecent(...mkRecent('a', 100));
    await saveRecent(...mkRecent('a', 900));

    const recents = await loadRecents();
    expect(recents).toHaveLength(1);
    expect(recents[0].openedAt).toBe(900);
  });

  it('evicts the oldest entries beyond the count cap, bytes included', async () => {
    for (let i = 0; i < RECENTS_MAX_COUNT + 1; i++) {
      await saveRecent(...mkRecent(`f${i}`, i));
    }
    const recents = await loadRecents();
    expect(recents).toHaveLength(RECENTS_MAX_COUNT);
    expect(recents.some((r) => r.hash === 'f0')).toBe(false);
    expect(await getRecentBytes('f0')).toBeNull();
    expect(await getRecentBytes('f1')).not.toBeNull();
  });

  it('evicts the oldest entries beyond the size cap', async () => {
    const big = new Uint8Array(1);
    // Fake sizes via meta (bytes stay tiny so the test is fast).
    await saveRecent({ ...mkRecent('a', 1, big)[0], size: RECENTS_MAX_BYTES - 5 }, big);
    await saveRecent({ ...mkRecent('b', 2, big)[0], size: 10 }, big);

    const recents = await loadRecents();
    expect(recents.map((r) => r.hash)).toEqual(['b']);
    expect(await getRecentBytes('a')).toBeNull();
  });

  it('a single over-cap file survives alone', async () => {
    const big = new Uint8Array(1);
    await saveRecent({ ...mkRecent('a', 1, big)[0], size: RECENTS_MAX_BYTES + 5 }, big);
    expect((await loadRecents()).map((r) => r.hash)).toEqual(['a']);
  });

  it('removeRecent drops one entry, meta and bytes', async () => {
    await saveRecent(...mkRecent('a', 1));
    await saveRecent(...mkRecent('b', 2));
    await removeRecent('a');

    expect((await loadRecents()).map((r) => r.hash)).toEqual(['b']);
    expect(await getRecentBytes('a')).toBeNull();
  });

  it('clearRecents drops everything', async () => {
    await saveRecent(...mkRecent('a', 1));
    await saveRecent(...mkRecent('b', 2));
    await clearRecents();

    expect(await loadRecents()).toEqual([]);
    expect(await getRecentBytes('a')).toBeNull();
  });

  it('clearSession leaves recents intact', async () => {
    await saveDocs([mkDoc('d1', 'a', [1])]);
    await saveState({
      savedAt: 1,
      pages: mkPages(1, 'd1'),
      splitMarks: [],
      look: 'blocks',
    });
    await saveRecent(...mkRecent('a', 1));

    await clearSession();

    expect(await loadSession()).toBeNull();
    expect(await loadRecents()).toHaveLength(1);
    expect(await getRecentBytes('a')).not.toBeNull();
  });

  it('getRecentBytes returns null for unknown hashes', async () => {
    expect(await getRecentBytes('nope')).toBeNull();
  });

  it('pinned entries are never evicted; the oldest unpinned goes instead', async () => {
    await saveRecent(...mkRecent('keeper', 0, new Uint8Array([1]), { pinned: true }));
    for (let i = 1; i <= RECENTS_MAX_COUNT; i++) {
      await saveRecent(...mkRecent(`f${i}`, i));
    }
    const recents = await loadRecents();
    expect(recents).toHaveLength(RECENTS_MAX_COUNT);
    expect(recents.some((r) => r.hash === 'keeper')).toBe(true);
    expect(recents.some((r) => r.hash === 'f1')).toBe(false); // oldest unpinned evicted
    expect(await getRecentBytes('keeper')).not.toBeNull();
  });

  it('setRecentPinned toggles, survives a re-open, and sorts pinned first', async () => {
    await saveRecent(...mkRecent('a', 1));
    await saveRecent(...mkRecent('b', 2));
    await setRecentPinned('a', true);

    // Re-opening the same file (fresh meta, no pinned field) keeps the pin.
    await saveRecent(...mkRecent('a', 3));

    let recents = await loadRecents();
    expect(recents.map((r) => r.hash)).toEqual(['a', 'b']); // pinned first
    expect(recents[0].pinned).toBe(true);

    await setRecentPinned('a', false);
    recents = await loadRecents();
    expect(recents.map((r) => r.hash)).toEqual(['a', 'b']); // now by openedAt (3 > 2)
    expect(recents[0].pinned).toBe(false);
  });

  it('setRecentPinned on a missing hash is a no-op', async () => {
    await expect(setRecentPinned('nope', true)).resolves.toBeUndefined();
    expect(await loadRecents()).toEqual([]);
  });
});
