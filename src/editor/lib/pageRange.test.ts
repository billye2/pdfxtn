import { describe, it, expect } from 'vitest';
import { parsePageRange } from './pageRange';

describe('parsePageRange', () => {
  it('parses a single page (1-based → 0-based)', () => {
    expect(parsePageRange('3', 10)).toEqual([2]);
  });
  it('parses an ascending range', () => {
    expect(parsePageRange('1-3', 10)).toEqual([0, 1, 2]);
  });
  it('parses a descending range', () => {
    expect(parsePageRange('5-3', 10)).toEqual([4, 3, 2]);
  });
  it('parses a mixed list and preserves order', () => {
    expect(parsePageRange('1-3, 5, 8-10', 10)).toEqual([0, 1, 2, 4, 7, 8, 9]);
  });
  it('tolerates whitespace and empty segments', () => {
    expect(parsePageRange('  2 ,, 4 ', 10)).toEqual([1, 3]);
  });
  it('preserves repeats as typed', () => {
    expect(parsePageRange('2,2', 10)).toEqual([1, 1]);
  });
  it('throws on empty input', () => {
    expect(() => parsePageRange('   ', 10)).toThrow();
  });
  it('throws when out of range', () => {
    expect(() => parsePageRange('11', 10)).toThrow(/out of range/);
    expect(() => parsePageRange('0', 10)).toThrow(/out of range/);
  });
  it('throws on garbage tokens', () => {
    expect(() => parsePageRange('1-3, abc', 10)).toThrow(/valid page/);
  });
});
