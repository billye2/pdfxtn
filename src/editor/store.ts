import {
  applyCrop,
  deleteSelected,
  reorder,
  rotateSelected,
  type CropRect,
  type PageDescriptor,
} from './lib/pageModel';

export type AppState = 'empty' | 'loading' | 'editor';

// Editable state that participates in undo/redo. Loaded documents live outside
// this (in App) because they hold pdf.js objects and never need undoing.
export interface EditState {
  pages: PageDescriptor[];
  selected: Set<string>;
  /** Page ids that begin a new section when splitting. */
  splitMarks: Set<string>;
}

export interface HistoryState {
  past: EditState[];
  present: EditState;
  future: EditState[];
}

export const initialEdit: EditState = {
  pages: [],
  selected: new Set(),
  splitMarks: new Set(),
};

export const initialHistory: HistoryState = {
  past: [],
  present: initialEdit,
  future: [],
};

export type Action =
  | { type: 'addPages'; pages: PageDescriptor[] }
  | { type: 'reorder'; from: number; to: number }
  | { type: 'toggleSelect'; id: string; additive: boolean }
  | { type: 'selectRangeTo'; id: string }
  | { type: 'selectAll' }
  | { type: 'clearSelection' }
  | { type: 'deleteSelected' }
  | { type: 'extractSelected' }
  | { type: 'rotateSelected'; delta: 90 | -90 | 180 }
  | { type: 'rotateOne'; id: string; delta: 90 | -90 | 180 }
  | { type: 'applyCrop'; crop: CropRect | undefined; scope: 'all' | 'selected' }
  | { type: 'toggleSplitMark'; id: string }
  | { type: 'undo' }
  | { type: 'redo' };

// Mutations that should NOT push onto the undo stack (pure selection changes).
const SELECTION_ONLY = new Set<Action['type']>([
  'toggleSelect',
  'selectRangeTo',
  'selectAll',
  'clearSelection',
]);

function rangeBetween(
  pages: PageDescriptor[],
  anchorId: string | undefined,
  targetId: string,
): Set<string> {
  const ids = pages.map((p) => p.id);
  const ti = ids.indexOf(targetId);
  const ai = anchorId ? ids.indexOf(anchorId) : ti;
  if (ti < 0) return new Set();
  const [lo, hi] = ai <= ti ? [ai, ti] : [ti, ai];
  return new Set(ids.slice(Math.max(0, lo), hi + 1));
}

function applyEdit(state: EditState, action: Action): EditState {
  switch (action.type) {
    case 'addPages':
      return { ...state, pages: [...state.pages, ...action.pages] };

    case 'reorder':
      return { ...state, pages: reorder(state.pages, action.from, action.to) };

    case 'toggleSelect': {
      const next = action.additive ? new Set(state.selected) : new Set<string>();
      if (action.additive && state.selected.has(action.id)) next.delete(action.id);
      else next.add(action.id);
      return { ...state, selected: next };
    }

    case 'selectRangeTo': {
      const anchor = [...state.selected].pop();
      return { ...state, selected: rangeBetween(state.pages, anchor, action.id) };
    }

    case 'selectAll':
      return { ...state, selected: new Set(state.pages.map((p) => p.id)) };

    case 'clearSelection':
      return { ...state, selected: new Set() };

    case 'deleteSelected':
      return {
        pages: deleteSelected(state.pages, state.selected),
        selected: new Set(),
        splitMarks: state.splitMarks,
      };

    case 'extractSelected': {
      // Keep only the selected pages (in their current order).
      if (state.selected.size === 0) return state;
      return {
        pages: state.pages.filter((p) => state.selected.has(p.id)),
        selected: new Set(),
        splitMarks: state.splitMarks,
      };
    }

    case 'rotateSelected':
      return {
        ...state,
        pages: rotateSelected(state.pages, state.selected, action.delta),
      };

    case 'rotateOne':
      return {
        ...state,
        pages: rotateSelected(state.pages, new Set([action.id]), action.delta),
      };

    case 'applyCrop':
      return {
        ...state,
        pages: applyCrop(state.pages, action.crop, action.scope, state.selected),
      };

    case 'toggleSplitMark': {
      const next = new Set(state.splitMarks);
      if (next.has(action.id)) next.delete(action.id);
      else next.add(action.id);
      return { ...state, splitMarks: next };
    }

    default:
      return state;
  }
}

export function reducer(state: HistoryState, action: Action): HistoryState {
  if (action.type === 'undo') {
    if (state.past.length === 0) return state;
    const previous = state.past[state.past.length - 1];
    return {
      past: state.past.slice(0, -1),
      present: previous,
      future: [state.present, ...state.future],
    };
  }
  if (action.type === 'redo') {
    if (state.future.length === 0) return state;
    const next = state.future[0];
    return {
      past: [...state.past, state.present],
      present: next,
      future: state.future.slice(1),
    };
  }

  const nextPresent = applyEdit(state.present, action);
  if (nextPresent === state.present) return state;

  if (SELECTION_ONLY.has(action.type)) {
    // Selection changes update in place without growing history.
    return { ...state, present: nextPresent };
  }

  return { past: [...state.past, state.present], present: nextPresent, future: [] };
}
