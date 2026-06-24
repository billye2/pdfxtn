// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDialogs } from './useDialogs';

describe('useDialogs', () => {
  it('starts with nothing open', () => {
    const { result } = renderHook(() => useDialogs());
    expect(result.current.isOpen('crop')).toBe(false);
    expect(result.current.isOpen('mix')).toBe(false);
  });

  it('opens a dialog and reports only that one as open', () => {
    const { result } = renderHook(() => useDialogs());
    act(() => result.current.openDialog('crop'));
    expect(result.current.isOpen('crop')).toBe(true);
    expect(result.current.isOpen('range')).toBe(false);
  });

  it('opening a second dialog replaces the first (only one open at a time)', () => {
    const { result } = renderHook(() => useDialogs());
    act(() => result.current.openDialog('crop'));
    act(() => result.current.openDialog('images'));
    expect(result.current.isOpen('crop')).toBe(false);
    expect(result.current.isOpen('images')).toBe(true);
  });

  it('closeDialog clears the open dialog', () => {
    const { result } = renderHook(() => useDialogs());
    act(() => result.current.openDialog('splitEvery'));
    act(() => result.current.closeDialog());
    expect(result.current.isOpen('splitEvery')).toBe(false);
  });
});
