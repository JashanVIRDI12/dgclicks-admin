"use client";

import { useEffect } from "react";

import { useAppearanceStore } from "@/features/appearance/store";

/**
 * Writes the reader's appearance preferences onto `<html>`.
 *
 * An effect rather than a render-time write, because the document is an
 * external system — which is exactly what effects are for, and what keeps this
 * clear of the compiler rule against writing state during render.
 *
 * It renders nothing. Applying the attributes at the root rather than passing a
 * theme object down through context means components stay unaware that
 * appearance is configurable at all: they use `bg-card` and `.card-surface` and
 * inherit whatever those currently resolve to.
 */
export function AppearanceProvider() {
  const paletteId = useAppearanceStore((state) => state.paletteId);
  const customHue = useAppearanceStore((state) => state.customHue);
  const customChroma = useAppearanceStore((state) => state.customChroma);
  const density = useAppearanceStore((state) => state.density);
  const surface = useAppearanceStore((state) => state.surface);
  const gradient = useAppearanceStore((state) => state.gradient);
  const effects = useAppearanceStore((state) => state.effects);

  useEffect(() => {
    const root = document.documentElement;

    root.dataset.density = density;
    root.dataset.surface = surface;
    root.dataset.gradient = gradient;
    root.dataset.effects = effects ? "on" : "off";

    if (customHue === null) {
      root.dataset.palette = paletteId;
      // Clear the inline overrides so the palette's own rule takes back over.
      root.style.removeProperty("--accent-h");
      root.style.removeProperty("--accent-c");
      return;
    }

    // A custom hue outranks any named palette, so the attribute goes too —
    // leaving it would make the swatch list show a selection that is not what
    // the reader is actually looking at.
    delete root.dataset.palette;
    root.style.setProperty("--accent-h", String(customHue));
    root.style.setProperty("--accent-c", String(customChroma));
  }, [paletteId, customHue, customChroma, density, surface, gradient, effects]);

  return null;
}

/**
 * Applies the same preferences before first paint.
 *
 * Without this the first frame renders in the default indigo and then snaps to
 * the reader's accent once React hydrates — a flash on every single navigation,
 * which is precisely the kind of detail that separates a polished product from
 * one that merely has a theme picker.
 *
 * Runs from `localStorage` synchronously in `<head>`, the same trick
 * `next-themes` uses for light/dark. Wrapped in try/catch because storage
 * throws outright in some privacy modes, and a themed page is not worth a blank
 * one.
 */
export const APPEARANCE_INIT_SCRIPT = `
(function(){try{
  var raw = localStorage.getItem("dgclicks.appearance");
  if(!raw) return;
  var s = (JSON.parse(raw)||{}).state; if(!s) return;
  var r = document.documentElement;
  if(s.density) r.dataset.density = s.density;
  if(s.surface) r.dataset.surface = s.surface;
  if(s.gradient) r.dataset.gradient = s.gradient;
  r.dataset.effects = s.effects === false ? "off" : "on";
  if(typeof s.customHue === "number"){
    r.style.setProperty("--accent-h", String(s.customHue));
    r.style.setProperty("--accent-c", String(s.customChroma == null ? 0.16 : s.customChroma));
  } else if(s.paletteId){
    r.dataset.palette = s.paletteId;
  }
}catch(e){}})();
`;
