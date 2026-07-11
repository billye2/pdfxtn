import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  recordRecent,
  hashBytes,
  isRememberEnabled,
  setRememberEnabled,
} from './recents';
import { renderThumbnail, type LoadedDoc } from './pdfRender';
import { saveRecent } from './persist';

vi.mock('./pdfRender', () => ({ renderThumbnail: vi.fn() }));
vi.mock('./persist', () => ({ saveRecent: vi.fn() }));

const mkDoc = (bytes: number[], name = 'a.pdf'): LoadedDoc =>
  ({
    id: 'd1',
    name,
    bytes: new Uint8Array(bytes),
    pageCount: 3,
  }) as LoadedDoc;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(renderThumbnail).mockResolvedValue({
    toDataURL: () => 'data:image/jpeg;thumb',
  } as unknown as HTMLCanvasElement);
  vi.mocked(saveRecent).mockResolvedValue();
});

describe('hashBytes', () => {
  it('is stable for identical bytes and differs for different bytes', async () => {
    const a1 = await hashBytes(new Uint8Array([1, 2, 3]), 'a.pdf');
    const a2 = await hashBytes(new Uint8Array([1, 2, 3]), 'renamed.pdf');
    const b = await hashBytes(new Uint8Array([9]), 'a.pdf');
    expect(a1).toBe(a2); // content-addressed: rename doesn't duplicate
    expect(a1).not.toBe(b);
    expect(a1).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('recordRecent', () => {
  it('saves meta + bytes with a rendered thumbnail', async () => {
    const doc = mkDoc([1, 2, 3]);
    await recordRecent(doc);

    expect(renderThumbnail).toHaveBeenCalledWith(doc, 0, { maxEdge: 96 });
    const [meta, bytes] = vi.mocked(saveRecent).mock.calls[0];
    expect(meta).toMatchObject({
      name: 'a.pdf',
      size: 3,
      pageCount: 3,
      thumb: 'data:image/jpeg;thumb',
    });
    expect(meta.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(meta.openedAt).toBeGreaterThan(0);
    expect(bytes).toBe(doc.bytes);
  });

  it('still saves when thumbnail rendering fails', async () => {
    vi.mocked(renderThumbnail).mockRejectedValue(new Error('no canvas'));
    await recordRecent(mkDoc([1]));

    const [meta] = vi.mocked(saveRecent).mock.calls[0];
    expect(meta.thumb).toBeUndefined();
  });

  it('swallows storage failures', async () => {
    vi.mocked(saveRecent).mockRejectedValue(new Error('quota'));
    await expect(recordRecent(mkDoc([1]))).resolves.toBeUndefined();
  });
});

describe('remember off switch', () => {
  // Node has no localStorage — stub the minimal surface the setting uses.
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('defaults to enabled and round-trips the preference', () => {
    expect(isRememberEnabled()).toBe(true);
    setRememberEnabled(false);
    expect(isRememberEnabled()).toBe(false);
    setRememberEnabled(true);
    expect(isRememberEnabled()).toBe(true);
  });

  it('recordRecent does nothing while remembering is off', async () => {
    setRememberEnabled(false);
    await recordRecent(mkDoc([1]));
    expect(saveRecent).not.toHaveBeenCalled();
    expect(renderThumbnail).not.toHaveBeenCalled();
  });

  it('stays enabled when localStorage is unavailable', () => {
    vi.unstubAllGlobals();
    expect(isRememberEnabled()).toBe(true);
    expect(() => setRememberEnabled(false)).not.toThrow();
  });
});
