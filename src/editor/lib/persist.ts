import type { PageDescriptor } from './pageModel';

/**
 * Local autosave of the working session in IndexedDB, so an accidental reload
 * doesn't lose work. Two object stores keep large data out of the hot path:
 *
 * - `docs`  — the raw source-PDF bytes, keyed by docId. Written once when a doc
 *             is added (megabytes), never on every edit.
 * - `state` — the lightweight descriptor state (pages, split marks, theme),
 *             rewritten on each edit. Small, so frequent writes stay cheap.
 *
 * Everything degrades to a no-op if IndexedDB is unavailable (e.g. private mode).
 */

const DB_NAME = 'pdf-mana';
const DB_VERSION = 1;
const STATE_KEY = 'current';

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

/** Drop the entire saved session (both stores). */
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
