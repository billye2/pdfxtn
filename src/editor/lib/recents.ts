import type { LoadedDoc } from './pdfRender';
import { renderThumbnail } from './pdfRender';
import { saveRecent, type RecentMeta } from './persist';

/**
 * Records a just-opened file into the recents list. Lives outside persist.ts
 * so the pure IDB layer stays free of canvas and crypto concerns.
 *
 * Recording is strictly best-effort: a hashing, rendering, or storage failure
 * must never break the ingest that triggered it, so all errors are swallowed.
 */

/** Content hash so the same file opened twice dedupes to one entry. */
export async function hashBytes(bytes: Uint8Array, name: string): Promise<string> {
  try {
    const digest = await crypto.subtle.digest(
      'SHA-256',
      bytes.slice().buffer as ArrayBuffer,
    );
    return [...new Uint8Array(digest)]
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    // subtle unavailable (rare) — a weak but stable fallback beats no recents.
    return `${name}|${bytes.length}`;
  }
}

async function makeThumb(doc: LoadedDoc): Promise<string | undefined> {
  try {
    const canvas = await renderThumbnail(doc, 0, { maxEdge: 96 });
    return canvas.toDataURL('image/jpeg', 0.8);
  } catch {
    return undefined; // UI shows a placeholder
  }
}

export async function recordRecent(doc: LoadedDoc): Promise<void> {
  try {
    const meta: RecentMeta = {
      hash: await hashBytes(doc.bytes, doc.name),
      name: doc.name,
      size: doc.bytes.length,
      pageCount: doc.pageCount,
      openedAt: Date.now(),
      thumb: await makeThumb(doc),
    };
    await saveRecent(meta, doc.bytes);
  } catch {
    // best-effort — never let recents bookkeeping break an ingest
  }
}
