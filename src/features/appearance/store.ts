"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  DEFAULT_PALETTE_ID,
  type Density,
  type Gradient,
  type Surface,
} from "@/features/appearance/palettes";

export const APPEARANCE_STORAGE_KEY = "dgclicks.appearance";

type AppearanceState = {
  paletteId: string;
  /**
   * A hue the reader chose themselves, 0–360. Overrides `paletteId` when set.
   * Only the hue is kept: see the note in `palettes.ts` on why a full colour
   * would be a contrast bug waiting to happen.
   */
  customHue: number | null;
  customChroma: number;

  density: Density;
  surface: Surface;
  gradient: Gradient;
  /**
   * Off disables the decorative layer — accent glows, gradient washes, the
   * completion flourish — while leaving every functional transition in place.
   * Distinct from the OS `prefers-reduced-motion`, which this never overrides:
   * that one always wins.
   */
  effects: boolean;

  setPalette: (paletteId: string) => void;
  setCustomHue: (hue: number | null) => void;
  setCustomChroma: (chroma: number) => void;
  setDensity: (density: Density) => void;
  setSurface: (surface: Surface) => void;
  setGradient: (gradient: Gradient) => void;
  setEffects: (effects: boolean) => void;
  reset: () => void;
};

const DEFAULTS = {
  paletteId: DEFAULT_PALETTE_ID,
  customHue: null,
  customChroma: 0.16,
  density: "comfortable",
  surface: "elevated",
  gradient: "subtle",
  effects: true,
} satisfies Partial<AppearanceState>;

/**
 * How this workspace looks to *this* person.
 *
 * Kept in local storage rather than on the user record on purpose: appearance
 * is per-device, not per-account. The same person on a laptop in a bright room
 * and a phone at night does not want one answer forced on both, and a
 * round trip to change an accent colour would make the picker feel broken.
 *
 * Separate from `ui-store` because that holds transient chrome — a sheet that
 * is open, a palette that is showing. This is a preference, and mixing the two
 * would mean either persisting things that should not survive a reload, or
 * hand-listing exceptions in `partialize` forever.
 */
export const useAppearanceStore = create<AppearanceState>()(
  persist(
    (set) => ({
      ...DEFAULTS,

      setPalette: (paletteId) => set({ paletteId, customHue: null }),
      setCustomHue: (customHue) => set({ customHue }),
      setCustomChroma: (customChroma) => set({ customChroma }),
      setDensity: (density) => set({ density }),
      setSurface: (surface) => set({ surface }),
      setGradient: (gradient) => set({ gradient }),
      setEffects: (effects) => set({ effects }),
      reset: () => set(DEFAULTS),
    }),
    { name: APPEARANCE_STORAGE_KEY },
  ),
);
