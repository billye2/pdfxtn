import { describe, it, expect } from 'vitest';
import { cropFrameLayout, effectiveAspect } from './cropView';
import type { CropRect } from './pageModel';

const QUAD: CropRect = { x: 0, y: 0, w: 0.5, h: 0.5 }; // top-left quadrant

describe('effectiveAspect', () => {
  it('returns the page aspect when uncropped and unrotated', () => {
    expect(effectiveAspect(0.75, undefined, 0)).toBe(0.75);
    expect(effectiveAspect(0.75, undefined, 180)).toBe(0.75);
  });

  it('inverts the aspect at 90/270', () => {
    expect(effectiveAspect(0.75, undefined, 90)).toBeCloseTo(1 / 0.75);
    expect(effectiveAspect(0.75, undefined, 270)).toBeCloseTo(1 / 0.75);
  });

  it('reflects the crop shape', () => {
    // Wide strip of a square page: aspect 1 * (0.8 / 0.2) = 4.
    const strip: CropRect = { x: 0.1, y: 0.4, w: 0.8, h: 0.2 };
    expect(effectiveAspect(1, strip, 0)).toBeCloseTo(4);
    expect(effectiveAspect(1, strip, 90)).toBeCloseTo(0.25);
  });
});

describe('cropFrameLayout', () => {
  it('fills the frame exactly when uncropped and unrotated', () => {
    expect(cropFrameLayout(100, 150, undefined, 0)).toEqual({
      w: 100,
      h: 150,
      left: 0,
      top: 0,
    });
  });

  it('swaps dimensions and recenters for an uncropped 90° page', () => {
    // Frame is the rotated page (150w × 100h); the element is laid out
    // pre-rotation (100 × 150) centered so rotation lands it on the frame.
    expect(cropFrameLayout(150, 100, undefined, 90)).toEqual({
      w: 100,
      h: 150,
      left: 25,
      top: -25,
    });
  });

  it('positions a quadrant crop at 0°', () => {
    // 100×50 frame showing the top-left quadrant: page element is 200×100
    // with the quadrant's top-left at the frame origin.
    expect(cropFrameLayout(100, 50, QUAD, 0)).toEqual({
      w: 200,
      h: 100,
      left: 0,
      top: 0,
    });
  });

  it('positions a quadrant crop at 90°', () => {
    // Rotating the page 90° clockwise sends the top-left quadrant to the
    // top-right; the layout must bring it back to fill the frame.
    const l = cropFrameLayout(100, 50, QUAD, 90);
    expect(l).toEqual({ w: 100, h: 200, left: -50, top: -50 });
    // Verify: element center (0, 50); quadrant center offset pre-rotation is
    // (-25, -50), rotated 90° cw -> (50, -25); lands at (50, 25) = frame center.
  });

  it('positions a quadrant crop at 180°', () => {
    // 180° sends the top-left quadrant to the bottom-right.
    const l = cropFrameLayout(100, 50, QUAD, 180);
    expect(l).toEqual({ w: 200, h: 100, left: -100, top: -50 });
  });

  it('centers a centered crop for every rotation', () => {
    const center: CropRect = { x: 0.25, y: 0.25, w: 0.5, h: 0.5 };
    for (const r of [0, 90, 180, 270] as const) {
      const l = cropFrameLayout(80, 80, center, r);
      // Element is 160×160 centered in the 80×80 frame regardless of rotation.
      expect(l).toEqual({ w: 160, h: 160, left: -40, top: -40 });
    }
  });
});
