// Single source of truth for the post card's warm "Disposable Camera" palette
// (see DESIGN.md §2). Both renderers consume these so the WebGL texture
// (cardTexture.ts) and the DOM card (PostCardContent / DomOverlay / DetailModal)
// can never drift. Values are sRGB hex realizations of the canonical OKLCH
// tokens — kept as hex so they parse identically in Canvas2D and the DOM.

export const CARD_COLORS = {
  /** the paper wall behind the cards — oklch(95.5% 0.008 60) */
  wall: "#f4efeb",
  /** Polaroid White card body, clearly lighter than the wall — oklch(98.5% 0.005 75) */
  surface: "#fcfaf6",
  /** warm near-black primary text: name, message — oklch(24% 0.012 50) */
  ink: "#241e1a",
  /** meta / stamp text; passes AA (~5.2:1) on surface — oklch(52% 0.014 55) */
  mutedInk: "#706761",
  /** monogram avatar background — oklch(88% 0.008 55) */
  avatarFill: "#dcd6d3",
  /** monogram glyph — oklch(45% 0.013 55) */
  avatarInk: "#5b544f",
  /** warm fill behind a photo while it loads or if it fails — oklch(91% 0.008 60) */
  mediaPlaceholder: "#e5e0dc",
} as const;

/** warm "print resting on the wall" shadow — replaces the cool rgba-black drop. */
export const CARD_SHADOW_REST = "0 6px 18px rgba(54, 43, 37, 0.16)";
/** deeper warm shadow for a print lifted on hover/focus (paired with translateY). */
export const CARD_SHADOW_LIFT = "0 12px 28px rgba(54, 43, 37, 0.22)";
/** Canvas2D takes the shadow color separately from blur/offset. */
export const CARD_SHADOW_REST_COLOR = "rgba(54, 43, 37, 0.16)";
