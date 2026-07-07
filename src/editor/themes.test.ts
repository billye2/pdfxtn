import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadSavedLook, saveLook } from './themes';

// Minimal localStorage stub — the vitest jsdom environment in this repo does
// not expose one, and a Map-backed fake keeps the tests deterministic.
let store: Map<string, string>;

beforeEach(() => {
  store = new Map();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
  };
});

afterEach(() => {
  delete (globalThis as { localStorage?: unknown }).localStorage;
});

describe('look persistence', () => {
  it('falls back to the default when nothing is stored', () => {
    expect(loadSavedLook()).toBe('blocks');
  });

  it('round-trips the saved look', () => {
    saveLook('midnight');
    expect(loadSavedLook()).toBe('midnight');
  });

  it('ignores a stored value that is not a known look', () => {
    store.set('pdf-mana-look', 'neon');
    expect(loadSavedLook()).toBe('blocks');
  });

  it('degrades to the default when storage is unavailable', () => {
    delete (globalThis as { localStorage?: unknown }).localStorage;
    expect(loadSavedLook()).toBe('blocks');
    expect(() => saveLook('sunny')).not.toThrow();
  });
});
