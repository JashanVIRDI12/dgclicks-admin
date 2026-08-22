/**
 * The accent palettes, defined as hue and chroma only.
 *
 * Deliberately *not* hex values. A palette that shipped finished colours would
 * have to ship two of every one — light mode needs an accent dark enough for
 * white text, dark mode needs one bright enough to read on near-black — and the
 * day someone adds a ninth palette, half of those pairs would quietly fail
 * contrast.
 *
 * Instead a palette carries only the two dimensions that make it *itself*: where
 * it sits on the colour wheel, and how saturated it is. Lightness stays under
 * the system's control, fixed per mode in `globals.css`. That is what makes the
 * custom-colour picker safe: whatever colour someone lands on, we keep its hue
 * and re-derive a lightness that still clears 4.5:1.
 *
 * Chroma is tuned per hue rather than shared. Human vision does not read
 * saturation evenly around the wheel — yellows and greens read far more intense
 * than blues at the same chroma — so a single value would make Sunset shout
 * while Electric sulked.
 */
export type Palette = {
  readonly id: string;
  readonly name: string;
  /** OKLCH hue angle, 0–360. */
  readonly hue: number;
  /** OKLCH chroma. 0 is a true neutral; above ~0.2 clips on sRGB screens. */
  readonly chroma: number;
  readonly description: string;
};

export const PALETTES: readonly Palette[] = [
  {
    id: "vercel",
    name: "Vercel",
    hue: 254,
    chroma: 0.21,
    description: "One electric blue against true neutrals. The default.",
  },
  {
    id: "midnight",
    name: "Midnight",
    hue: 272,
    chroma: 0.2,
    description: "Deep indigo.",
  },
  {
    id: "aurora",
    name: "Aurora",
    hue: 196,
    chroma: 0.14,
    description: "Cold teal, like light on ice.",
  },
  {
    id: "electric",
    name: "Electric Blue",
    hue: 250,
    chroma: 0.19,
    description: "Saturated, confident blue.",
  },
  {
    id: "cyber",
    name: "Cyber Purple",
    hue: 305,
    chroma: 0.19,
    description: "Violet with a magenta lean.",
  },
  {
    id: "emerald",
    name: "Emerald",
    hue: 162,
    chroma: 0.13,
    description: "Green that reads calm, not clinical.",
  },
  {
    id: "sunset",
    name: "Sunset",
    hue: 42,
    chroma: 0.15,
    description: "Warm amber through to orange.",
  },
  {
    id: "minimal",
    name: "Minimal",
    hue: 240,
    chroma: 0.04,
    description: "Barely-there blue. Lets content lead.",
  },
  {
    id: "monochrome",
    name: "Monochrome",
    hue: 0,
    chroma: 0,
    description: "No colour at all. Pure contrast.",
  },
];

export const DEFAULT_PALETTE_ID = "vercel";

export function findPalette(id: string): Palette | undefined {
  return PALETTES.find((palette) => palette.id === id);
}

/**
 * A swatch to preview a palette with, at a lightness that reads on either
 * background. Preview only — the real accents are derived in CSS per mode.
 */
export function swatchColor(hue: number, chroma: number): string {
  return `oklch(0.62 ${chroma} ${hue})`;
}

/** Density changes how much air the interface has, not how big the text is. */
export const DENSITIES = ["compact", "comfortable", "spacious"] as const;
export type Density = (typeof DENSITIES)[number];

export const DENSITY_LABELS: Record<Density, string> = {
  compact: "Compact",
  comfortable: "Comfortable",
  spacious: "Spacious",
};

/** How cards and panels separate themselves from the page behind them. */
export const SURFACES = ["flat", "elevated", "glass"] as const;
export type Surface = (typeof SURFACES)[number];

export const SURFACE_LABELS: Record<Surface, string> = {
  flat: "Flat",
  elevated: "Elevated",
  glass: "Glass",
};

export const GRADIENTS = ["none", "subtle", "vivid"] as const;
export type Gradient = (typeof GRADIENTS)[number];

export const GRADIENT_LABELS: Record<Gradient, string> = {
  none: "None",
  subtle: "Subtle",
  vivid: "Vivid",
};
