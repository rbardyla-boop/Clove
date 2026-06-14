/**
 * Color helpers operating on in-house hex tokens only. No external color libraries, no user-supplied
 * free-form hex at runtime — callers resolve a *token* to hex via the closed palette tables in
 * validation/tokens.js, then use these to derive shades. Pure; Three.js consumes the numbers.
 */

/** '#rrggbb' → 0xrrggbb integer (Three.Color accepts this). Falls back to mid-grey on bad input. */
export function hexToInt(hex) {
  if (typeof hex !== 'string') return 0x808080;
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  return m ? parseInt(m[1], 16) : 0x808080;
}

/** Integer → '#rrggbb'. */
export function intToHex(int) {
  return `#${(int & 0xffffff).toString(16).padStart(6, '0')}`;
}

function toRgb(int) {
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}
function fromRgb(r, g, b) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v)));
  return (c(r) << 16) | (c(g) << 8) | c(b);
}

/** Multiply brightness by `f` (f<1 darken, f>1 lighten, clamped). */
export function scaleColor(int, f) {
  const [r, g, b] = toRgb(int);
  return fromRgb(r * f, g * f, b * f);
}

/** Mix two integer colors by `t` in [0,1]. */
export function mixColor(a, b, t) {
  const [ar, ag, ab] = toRgb(a);
  const [br, bg, bb] = toRgb(b);
  return fromRgb(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

/** Relative luminance (0..1) — used to pick legible marquee text color. */
export function luminance(int) {
  const [r, g, b] = toRgb(int).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
