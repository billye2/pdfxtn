import type { CropRect, Rotation } from './pageModel';

// Geometry for WYSIWYG crop previews: the full page renders once (unrotated),
// then CSS positions it inside an overflow:hidden frame so only the rotated
// crop region shows — no pdf.js re-render when crop/rotation change.

const FULL: CropRect = { x: 0, y: 0, w: 1, h: 1 };

/** w/h aspect of the displayed (cropped-then-rotated) region. */
export function effectiveAspect(
  pageAspect: number,
  crop: CropRect | undefined,
  rotation: Rotation,
): number {
  const c = crop ?? FULL;
  const a = pageAspect * (c.w / c.h);
  return rotation === 90 || rotation === 270 ? 1 / a : a;
}

export interface FrameLayout {
  w: number;
  h: number;
  left: number;
  top: number;
}

/**
 * Size/position of the full-page element inside an overflow:hidden frame so
 * the rotated crop region exactly fills the frame. Apply `rotate(<rotation>deg)`
 * with the default (center) transform-origin.
 *
 * The crop center, rotated about the page element's center, must land on the
 * frame center; the sizing makes the crop region measure exactly frameW×frameH
 * after rotation (90/270 swap which frame edge each crop edge must match).
 */
export function cropFrameLayout(
  frameW: number,
  frameH: number,
  crop: CropRect | undefined,
  rotation: Rotation,
): FrameLayout {
  const c = crop ?? FULL;
  const swap = rotation === 90 || rotation === 270;
  const w = (swap ? frameH : frameW) / c.w;
  const h = (swap ? frameW : frameH) / c.h;
  // Crop-center offset from the page center, pre-rotation.
  const dx = (c.x + c.w / 2 - 0.5) * w;
  const dy = (c.y + c.h / 2 - 0.5) * h;
  // CSS rotate is clockwise in a y-down space: 90° maps (x,y) -> (-y,x).
  const [rx, ry] =
    rotation === 90
      ? [-dy, dx]
      : rotation === 180
        ? [-dx, -dy]
        : rotation === 270
          ? [dy, -dx]
          : [dx, dy];
  return {
    w,
    h,
    left: frameW / 2 - w / 2 - rx,
    top: frameH / 2 - h / 2 - ry,
  };
}
