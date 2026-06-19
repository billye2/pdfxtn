// Parse a human page-range string like "1-3, 5, 8-10" into zero-based page
// indices, validated against the current page count. Page numbers are 1-based
// (matching the "Page {n}" labels). Ranges may ascend or descend ("5-3" →
// 5,4,3). Order and repeats are preserved as typed.

export function parsePageRange(input: string, total: number): number[] {
  const trimmed = input.trim();
  if (!trimmed) throw new Error('Enter a page range, e.g. 1-3, 5');

  const indices: number[] = [];
  for (const rawPart of trimmed.split(',')) {
    const part = rawPart.trim();
    if (!part) continue;

    const range = part.match(/^(\d+)\s*-\s*(\d+)$/);
    const single = part.match(/^(\d+)$/);

    if (range) {
      const a = Number(range[1]);
      const b = Number(range[2]);
      validate(a, total);
      validate(b, total);
      const step = a <= b ? 1 : -1;
      for (let n = a; step > 0 ? n <= b : n >= b; n += step) {
        indices.push(n - 1);
      }
    } else if (single) {
      const n = Number(single[1]);
      validate(n, total);
      indices.push(n - 1);
    } else {
      throw new Error(`"${part}" isn't a valid page or range`);
    }
  }

  if (indices.length === 0) throw new Error('No pages selected');
  return indices;
}

function validate(n: number, total: number): void {
  if (n < 1 || n > total) {
    throw new Error(`Page ${n} is out of range (1–${total})`);
  }
}
