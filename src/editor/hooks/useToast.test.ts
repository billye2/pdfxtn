// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToast } from './useToast';

describe('useToast', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('starts with no toast', () => {
    const { result } = renderHook(() => useToast());
    expect(result.current.toast).toBeNull();
  });

  it('shows a toast, defaulting to the success tone', () => {
    const { result } = renderHook(() => useToast());
    act(() => result.current.showToast('Saved'));
    expect(result.current.toast).toEqual({ message: 'Saved', tone: 'success' });
  });

  it('honors an explicit error tone', () => {
    const { result } = renderHook(() => useToast());
    act(() => result.current.showToast('Boom', 'error'));
    expect(result.current.toast?.tone).toBe('error');
  });

  it('auto-dismisses after 3.5s', () => {
    const { result } = renderHook(() => useToast());
    act(() => result.current.showToast('Bye'));
    act(() => vi.advanceTimersByTime(3499));
    expect(result.current.toast).not.toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.toast).toBeNull();
  });

  it('a second toast replaces the first and resets the timer', () => {
    const { result } = renderHook(() => useToast());
    act(() => result.current.showToast('First'));
    act(() => vi.advanceTimersByTime(3000));
    act(() => result.current.showToast('Second'));
    // 3000ms after the first would have dismissed it, but the second reset the timer.
    act(() => vi.advanceTimersByTime(3000));
    expect(result.current.toast?.message).toBe('Second');
    act(() => vi.advanceTimersByTime(500));
    expect(result.current.toast).toBeNull();
  });
});
