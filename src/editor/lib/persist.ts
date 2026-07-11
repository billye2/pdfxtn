import type { PageDescriptor } from './pageModel';

/**
 * Local persistence in IndexedDB. Object stores keep large data out of the
 * hot path:
 *
 * - `docs`  — the raw source-PDF bytes for the current session, keyed by
 *             docId. Written once when a doc is added (megabytes), never on
 *             every edit.
 * - `state` — the lightweight descriptor state (pages, split marks, theme),
 *             rewritten on each edit. Small, so frequent writes stay cheap.
 * - `recentMeta`  — one small record per previously opened file (name, dates,
 *                   thumbnail), keyed by content hash. Loaded for the
 *                   empty-state list without touching the bytes.
 * - `recentBytes` — the raw bytes of previously opened files, keyed by the
 *                   same hash. Fetched only when a recent file is reopened.
 *
 * The session stores (`docs`/`state`) are cleared when the editor empties;
 * the recents stores survive independently, capped by count and total size.
 *
 * Everything degrades to a no-op if IndexedDB is unavailable (e.g. private mode).
 */

const DB_NAME = 'pdf-mana';
const DB_VERSION = 2;
const STATE_KEY = 'current';

export const RECENTS_MAX_COUNT = 10;
export const RECENTS_MAX_BYTES = 100 * 1024 * 1024;

export interface PersistedDoc {
  id: string;
  name: string;
  bytes: Uint8Array;
}

export interface PersistedState {
  savedAt: number;
  pages: PageDescriptor[];
  splitMarks: string[];
  look: string;
}

export interface RestoredSession {
  state: PersistedState;
  docs: PersistedDoc[];
}

export interface RecentMeta {
  hash: string;
  name: string;
  size: number;
  pageCount: number;
  openedAt: number;
  thumb?: string;
  /** Pinned entries are never evicted by the count/size caps. */
  pinned?: boolean;
}

function hasIDB(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('docs')) {
        db.createObjectStore('docs', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('state')) {
        db.createObjectStore('state');
      }
      if (!db.objectStoreNames.contains('recentMeta')) {
        db.createObjectStore('recentMeta', { keyPath: 'hash' });
      }
      if (!db.objectStoreNames.contains('recentBytes')) {
        db.createObjectStore('recentBytes');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function getAll<T>(store: IDBObjectStore): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

function get<T>(store: IDBObjectStore, key: IDBValidKey): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

/** Write/overwrite the source bytes for the given docs (idempotent by id). */
export async function saveDocs(docs: PersistedDoc[]): Promise<void> {
  if (!hasIDB() || docs.length === 0) return;
  const db = await openDb();
  try {
    const tx = db.transaction('docs', 'readwrite');
    const store = tx.objectStore('docs');
    for (const d of docs) store.put(d);
    await done(tx);
  } finally {
    db.close();
  }
}

/** Write the lightweight descriptor state under the single current-session key. */
export async function saveState(state: PersistedState): Promise<void> {
  if (!hasIDB()) return;
  const db = await openDb();
  try {
    const tx = db.transaction('state', 'readwrite');
    tx.objectStore('state').put(state, STATE_KEY);
    await done(tx);
  } finally {
    db.close();
  }
}

/** Load the saved session (state + the docs it references), or null if none. */
export async function loadSession(): Promise<RestoredSession | null> {
  if (!hasIDB()) return null;
  const db = await openDb();
  try {
    const state = await get<PersistedState>(
      db.transaction('state', 'readonly').objectStore('state'),
      STATE_KEY,
    );
    if (!state || state.pages.length === 0) return null;
    const allDocs = await getAll<PersistedDoc>(
      db.transaction('docs', 'readonly').objectStore('docs'),
    );
    const needed = new Set(state.pages.map((p) => p.docId));
    const docs = allDocs.filter((d) => needed.has(d.id));
    // If a referenced doc's bytes are missing, the session can't be rebuilt.
    if (docs.length < needed.size) return null;
    return { state, docs };
  } finally {
    db.close();
  }
}

/** Drop the entire saved session (both session stores; recents survive). */
export async function clearSession(): Promise<void> {
  if (!hasIDB()) return;
  const db = await openDb();
  try {
    const tx = db.transaction(['docs', 'state'], 'readwrite');
    tx.objectStore('docs').clear();
    tx.objectStore('state').clear();
    await done(tx);
  } finally {
    db.close();
  }
}

/**
 * Record a previously opened file (meta + bytes) and evict the oldest entries
 * until the count/size caps hold again. One transaction across both stores so
 * meta and bytes can never drift apart. Pinned entries and the entry being
 * saved are never evicted, even when that leaves the caps exceeded.
 * Re-recording an existing entry keeps its pinned flag.
 */
export async function saveRecent(meta: RecentMeta, bytes: Uint8Array): Promise<void> {
  if (!hasIDB()) return;
  const db = await openDb();
  try {
    const tx = db.transaction(['recentMeta', 'recentBytes'], 'readwrite');
    const metaStore = tx.objectStore('recentMeta');
    const bytesStore = tx.objectStore('recentBytes');
    const existing = await get<RecentMeta>(metaStore, meta.hash);
    metaStore.put({ ...meta, pinned: meta.pinned ?? existing?.pinned });
    bytesStore.put(bytes, meta.hash);

    const all = await getAll<RecentMeta>(metaStore);
    const evictable = all
      .filter((m) => m.hash !== meta.hash && !m.pinned)
      .sort((a, b) => a.openedAt - b.openedAt);
    let count = all.length;
    let total = all.reduce((sum, m) => sum + m.size, 0);
    for (const m of evictable) {
      if (count <= RECENTS_MAX_COUNT && total <= RECENTS_MAX_BYTES) break;
      metaStore.delete(m.hash);
      bytesStore.delete(m.hash);
      count -= 1;
      total -= m.size;
    }
    await done(tx);
  } finally {
    db.close();
  }
}

/** All recent-file metadata: pinned first, most recently opened first within each group. */
export async function loadRecents(): Promise<RecentMeta[]> {
  if (!hasIDB()) return [];
  const db = await openDb();
  try {
    const all = await getAll<RecentMeta>(
      db.transaction('recentMeta', 'readonly').objectStore('recentMeta'),
    );
    return all.sort(
      (a, b) =>
        Number(b.pinned ?? false) - Number(a.pinned ?? false) || b.openedAt - a.openedAt,
    );
  } finally {
    db.close();
  }
}

/** Pin or unpin one recent file. No-op if the entry no longer exists. */
export async function setRecentPinned(hash: string, pinned: boolean): Promise<void> {
  if (!hasIDB()) return;
  const db = await openDb();
  try {
    const tx = db.transaction('recentMeta', 'readwrite');
    const store = tx.objectStore('recentMeta');
    const meta = await get<RecentMeta>(store, hash);
    if (meta) store.put({ ...meta, pinned });
    await done(tx);
  } finally {
    db.close();
  }
}

/** The stored bytes for one recent file, or null if evicted/missing. */
export async function getRecentBytes(hash: string): Promise<Uint8Array | null> {
  if (!hasIDB()) return null;
  const db = await openDb();
  try {
    const bytes = await get<Uint8Array>(
      db.transaction('recentBytes', 'readonly').objectStore('recentBytes'),
      hash,
    );
    return bytes ?? null;
  } finally {
    db.close();
  }
}

/** Remove one recent file (meta + bytes). */
export async function removeRecent(hash: string): Promise<void> {
  if (!hasIDB()) return;
  const db = await openDb();
  try {
    const tx = db.transaction(['recentMeta', 'recentBytes'], 'readwrite');
    tx.objectStore('recentMeta').delete(hash);
    tx.objectStore('recentBytes').delete(hash);
    await done(tx);
  } finally {
    db.close();
  }
}

/** Remove all recent files. */
export async function clearRecents(): Promise<void> {
  if (!hasIDB()) return;
  const db = await openDb();
  try {
    const tx = db.transaction(['recentMeta', 'recentBytes'], 'readwrite');
    tx.objectStore('recentMeta').clear();
    tx.objectStore('recentBytes').clear();
    await done(tx);
  } finally {
    db.close();
  }
}
