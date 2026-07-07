# Split styles.css into co-located per-component files

## Context

`src/editor/styles.css` is 1,429 lines / ~186 rules styling 20+ components. It's healthy (no dead CSS found, no cascade-order landmines) but its size caused a real shipped bug: the Look-menu black-on-dark text happened because `.look-option`'s styles lived 400 lines from anything LookPicker-related, and nobody noticed the missing `color`. Co-locating each component's styles with its `.tsx` makes that class of omission visible at edit time and makes diffs/reviews touch the file that owns the change. The output bundle is identical (Vite concatenates all imported CSS into one file either way) — this is purely a source-organization change, made near-risk-free by the visual-regression suite (15 baselines × 5 themes must stay pixel-identical).

## Approach

Plain CSS files, imported by their owning component (the established Vite pattern — `main.tsx` already imports seven `@fontsource` CSS files). **No CSS Modules / no Tailwind**: hashed or rewritten class names would break the e2e selectors and all 15 visual baselines; plain-file moves keep every class name byte-identical.

Facts that make the split safe (verified by analysis):
- Zero same-specificity cross-file property collisions. The only ordering constraint: the shared base (reset, `button` element rule, `.btn-*` variants, keyframes) must load **before** component files — guaranteed by importing `base.css` in `main.tsx` ahead of `App`.
- All 10 `@keyframes` are cross-referenced (e.g. `pop` used by menu/card/modal) → they live in base.
- CSS variables are defined in `themes.ts` (inline on `.app`), not in the CSS — untouched.

## File layout (new `src/editor/styles/` + co-located component css)

**`src/editor/styles/base.css`** — imported by `main.tsx` (replacing `./styles.css`, after the fontsource imports):
- reset (`*`, `html/body`, `#root`), `.sr-only`, scrollbar rules
- all 10 `@keyframes` + `.spin`
- `button` base + `.btn-secondary/add/go/rotate/crop/split/del`, `.icon-btn`, `.big`
- `.app` root, `.save-bar*` (App-owned but global-ish; keeps main.tsx the only non-component importer)
- `.status-dot` (used by Header + EmptyState)
- the cross-component midnight-invert rule (styles.css 716–721) under a "theming" banner with a comment naming its four consumers

**Co-located `components/<Name>.css`, imported at the top of each `<Name>.tsx`:**
- Header.css, LookPicker.css, Toolbar.css, Banners.css, EmptyState.css (incl. mascot/decor), LoadingState.css, ThumbnailGrid.css (`.grid`), PageThumb.css (all `.card*` minus the invert rule), SelectionDock.css, Toast.css, Lightbox.css, PagePeek.css (incl. its `peek-in` keyframe → move to base with the others), DragOverlay.css
- **Modal.css** — modal shell (`.modal-backdrop`, `.modal`, `.modal h2`, `.modal-help`, `.modal-footer`, `.modal-help code`) **plus the shared dialog form primitives** `.range-input`, `.range-status`, `.range-error`, `.field-note`, `.field-row`, `.field-label` (`.range-input` is used by Range/Images/SplitEvery dialogs — it's a dialog primitive, not RangeDialog-owned)
- CropDialog.css (`.crop-*`), MixDialog.css (`.mix-*`), ImagesDialog.css (`.zip-toggle*`), SplitEveryDialog.css (`.split-every-row`, `.split-n`), SegmentedControl.css (`.seg`, `.seg-btn*`)
- `.main` (3 lines) → stays in base.css (App renders it)

Rules move **verbatim** — no reformatting, no renaming, no "improvements" in the same commit. Delete `src/editor/styles.css` at the end.

## Execution order

1. Create `styles/base.css`; switch `main.tsx` import; leave the rest of styles.css in place temporarily (both imported) → build + visual pass proves base extraction alone changed nothing.
2. Move component sections in batches (e.g. header/picker/toolbar, then grid/card, then dialogs, then overlays), deleting from styles.css as they move; run `npm run visual` after each batch.
3. Delete the emptied styles.css; full suite.

## Verification

- `npm run build` (clean), `npm test` (140), `npm run e2e` (30 functional+a11y — the a11y contrast scans double-check computed styles), and **`npm run visual` — all 15 baselines must pass unchanged, without regeneration**. Pixel-identical baselines are the proof the refactor is pure motion.
- Grep check at the end: `grep -c '{' ` totals across new files ≈ 196 blocks from the original (nothing dropped).
- Confirm dist output still emits a single CSS asset of ~the same size (54.4 kB today).

## Explicit non-goals

- No class renames, no CSS Modules, no utility framework, no style changes of any kind.
- No dead-style removal in this pass (none was found; if any turns up during the move, note it and remove in a follow-up commit).
