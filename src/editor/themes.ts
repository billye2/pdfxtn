// Four switchable "Looks". Each is a set of CSS custom properties applied to the
// app root as inline style vars. Keys mirror the design handoff tokens.
import type { CSSProperties } from 'react';

export type LookId = 'blocks' | 'bubble' | 'sticker' | 'midnight';

export interface Look {
  id: LookId;
  name: string;
  /** CSS custom properties (without the leading `--`). */
  vars: Record<string, string>;
}

export const LOOKS: Record<LookId, Look> = {
  blocks: {
    id: 'blocks',
    name: 'Blocks',
    vars: {
      bg: '#fdf3e2',
      bgImage: 'radial-gradient(rgba(54,50,79,0.06) 1.6px, transparent 1.6px)',
      bgSize: '22px 22px',
      ink: '#36324f',
      sub: '#7a6d66',
      barBg: '#fdf3e2',
      card: '#ffffff',
      cardOutline: '2.5px solid #f0e1c5',
      cardOutlineCol: '#f0e1c5',
      cardShadow: '0 4px 0 rgba(54,50,79,0.10)',
      radCard: '18px',
      thumbBg: '#fbf2df',
      page: '#ffffff',
      accentSoft: '#eaf5ff',
      'c-add': '#3b9bf0',
      'c-go': '#48c95f',
      'c-rotate': '#ffc83d',
      'c-crop': '#9b6bff',
      'c-split': '#ff8a3d',
      'c-del': '#ef5a52',
      'c-sel': '#3b9bf0',
      onColor: '#ffffff',
      rotateText: '#5a4600',
      btnRad: '13px',
      btnShadow: '0 4px 0 rgba(54,50,79,0.18)',
      btnShadowActive: '0 1px 0 rgba(54,50,79,0.18)',
      btnBorder: 'none',
      press: '3px',
      brand: '#ef5a52',
      coin: '#ffc83d',
      star: '#ff8a3d',
      'grid-min': '180px',
      'grid-gap': '22px',
    },
  },
  bubble: {
    id: 'bubble',
    name: 'Bubble',
    vars: {
      bg: '#fef3f8',
      bgImage: 'radial-gradient(rgba(160,120,200,0.07) 2px, transparent 2px)',
      bgSize: '30px 30px',
      ink: '#5a4a66',
      sub: '#b3a3bf',
      barBg: '#fdeef6',
      card: '#ffffff',
      cardOutline: '2px solid #f3e2ee',
      cardOutlineCol: '#f3e2ee',
      cardShadow: '0 8px 18px rgba(150,110,180,0.16)',
      radCard: '24px',
      thumbBg: '#fbf1f8',
      page: '#ffffff',
      accentSoft: '#eef6ff',
      'c-add': '#6cc0f2',
      'c-go': '#73d18a',
      'c-rotate': '#ffd98a',
      'c-crop': '#bfa1ff',
      'c-split': '#ffae84',
      'c-del': '#ff97a3',
      'c-sel': '#54a8e8',
      onColor: '#43354f',
      rotateText: '#5a4a30',
      btnRad: '999px',
      btnShadow: '0 6px 14px rgba(150,110,180,0.20)',
      btnShadowActive: '0 2px 6px rgba(150,110,180,0.20)',
      btnBorder: 'none',
      press: '2px',
      brand: '#ff97a3',
      coin: '#ffd98a',
      star: '#bfa1ff',
      'grid-min': '180px',
      'grid-gap': '24px',
    },
  },
  sticker: {
    id: 'sticker',
    name: 'Sticker',
    vars: {
      bg: '#fffdf5',
      bgImage: 'none',
      bgSize: 'auto',
      ink: '#241f2e',
      sub: '#8a8594',
      barBg: '#fffaf0',
      card: '#ffffff',
      cardOutline: '3px solid #241f2e',
      cardOutlineCol: '#241f2e',
      cardShadow: '3px 4px 0 #241f2e',
      radCard: '16px',
      thumbBg: '#f6f3ec',
      page: '#ffffff',
      accentSoft: '#e9f3ff',
      'c-add': '#3aa0ff',
      'c-go': '#43cf6b',
      'c-rotate': '#ffcb3a',
      'c-crop': '#a878ff',
      'c-split': '#ff7a3a',
      'c-del': '#ff5b54',
      'c-sel': '#3aa0ff',
      onColor: '#ffffff',
      rotateText: '#241f2e',
      btnRad: '12px',
      btnShadow: '0 3px 0 #241f2e',
      btnShadowActive: '0 1px 0 #241f2e',
      btnBorder: '2.5px solid #241f2e',
      press: '2px',
      brand: '#ff5b54',
      coin: '#ffcb3a',
      star: '#ff7a3a',
      'grid-min': '180px',
      'grid-gap': '22px',
    },
  },
  midnight: {
    id: 'midnight',
    name: 'Nighty Night',
    vars: {
      bg: '#161326',
      bgImage: 'radial-gradient(rgba(255,255,255,0.05) 1.6px, transparent 1.6px)',
      bgSize: '22px 22px',
      ink: '#f2eeff',
      sub: '#9b93b8',
      barBg: '#1c1830',
      card: '#221d38',
      cardOutline: '2px solid #322a4f',
      cardOutlineCol: '#322a4f',
      cardShadow: '0 4px 0 rgba(0,0,0,0.35)',
      radCard: '18px',
      thumbBg: '#2a2444',
      page: '#f4f1fb',
      accentSoft: '#33294f',
      'c-add': '#5ab0ff',
      'c-go': '#4ad787',
      'c-rotate': '#ffd24d',
      'c-crop': '#b78bff',
      'c-split': '#ff9d5c',
      'c-del': '#ff6d68',
      'c-sel': '#5ab0ff',
      onColor: '#161326',
      rotateText: '#3a2c00',
      btnRad: '13px',
      btnShadow: '0 4px 0 rgba(0,0,0,0.45)',
      btnShadowActive: '0 1px 0 rgba(0,0,0,0.45)',
      btnBorder: 'none',
      press: '3px',
      brand: '#ff6d68',
      coin: '#ffd24d',
      star: '#ff9d5c',
      'grid-min': '180px',
      'grid-gap': '22px',
    },
  },
};

export const LOOK_ORDER: LookId[] = ['blocks', 'bubble', 'sticker', 'midnight'];

/** Convert a Look's tokens into a React inline-style object of CSS vars. */
export function lookStyle(look: LookId): CSSProperties {
  const style: Record<string, string> = {};
  for (const [k, v] of Object.entries(LOOKS[look].vars)) {
    style[`--${k}`] = v;
  }
  return style as CSSProperties;
}

const LOOK_STORAGE_KEY = 'pdf-mana-look';

/** Last-used look from localStorage, falling back to the default. */
export function loadSavedLook(): LookId {
  try {
    const v = localStorage.getItem(LOOK_STORAGE_KEY);
    if (v && v in LOOKS) return v as LookId;
  } catch {
    // storage unavailable (e.g. blocked) — fall through to the default
  }
  return 'blocks';
}

export function saveLook(look: LookId): void {
  try {
    localStorage.setItem(LOOK_STORAGE_KEY, look);
  } catch {
    // best-effort; losing the preference is fine
  }
}
