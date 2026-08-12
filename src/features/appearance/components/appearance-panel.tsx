"use client";

import { CheckIcon, SparklesIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  DENSITIES,
  DENSITY_LABELS,
  GRADIENTS,
  GRADIENT_LABELS,
  PALETTES,
  SURFACES,
  SURFACE_LABELS,
  swatchColor,
} from "@/features/appearance/palettes";
import { useAppearanceStore } from "@/features/appearance/store";
import { cn } from "@/lib/utils";

/** Three cards at different urgencies, so the priority wash is visible. */
const PREVIEW_CARDS = [
  {
    title: "Ship the pricing page copy",
    priority: "urgent",
    label: "Launch",
    meta: "Today",
  },
  {
    title: "Review Q3 analytics export",
    priority: "medium",
    label: "Reporting",
    meta: "Fri",
  },
  {
    title: "Tidy the component library",
    priority: "low",
    label: "Chore",
    meta: "Next week",
  },
] as const;

/**
 * True only once the client has taken over.
 *
 * These preferences live in `localStorage`, which the server cannot read, so
 * the first render has to be the same on both sides or hydration reconciles
 * over a selection that was never really there. `useSyncExternalStore` answers
 * that with a different value per environment and no state to set — the
 * mount-flag-in-an-effect version of this is a cascading render, which the
 * compiler rules reject on sight.
 */
const neverChanges = () => () => {};

function useIsHydrated(): boolean {
  return useSyncExternalStore(
    neverChanges,
    () => true,
    () => false,
  );
}

/** A labelled group of mutually exclusive choices, rendered as a segmented row. */
function Segmented<T extends string>({
  label,
  description,
  options,
  value,
  onChange,
}: {
  label: string;
  description: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>

      <div
        role="radiogroup"
        aria-label={label}
        className="inline-flex gap-0.5 rounded-lg bg-surface p-0.5"
      >
        {options.map((option) => {
          const isActive = option.value === value;

          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => onChange(option.value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                isActive
                  ? "bg-card text-foreground shadow-soft"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Theme and appearance.
 *
 * Everything here is per-device and takes effect the instant it is chosen —
 * there is no Save button and no round trip, because a colour picker that makes
 * you wait to see the colour is not a colour picker.
 */
export function AppearancePanel() {
  const { theme, setTheme } = useTheme();
  const isHydrated = useIsHydrated();

  const paletteId = useAppearanceStore((state) => state.paletteId);
  const customHue = useAppearanceStore((state) => state.customHue);
  const customChroma = useAppearanceStore((state) => state.customChroma);
  const density = useAppearanceStore((state) => state.density);
  const surface = useAppearanceStore((state) => state.surface);
  const gradient = useAppearanceStore((state) => state.gradient);
  const effects = useAppearanceStore((state) => state.effects);

  const setPalette = useAppearanceStore((state) => state.setPalette);
  const setCustomHue = useAppearanceStore((state) => state.setCustomHue);
  const setCustomChroma = useAppearanceStore((state) => state.setCustomChroma);
  const setDensity = useAppearanceStore((state) => state.setDensity);
  const setSurface = useAppearanceStore((state) => state.setSurface);
  const setGradient = useAppearanceStore((state) => state.setGradient);
  const setEffects = useAppearanceStore((state) => state.setEffects);
  const reset = useAppearanceStore((state) => state.reset);

  if (!isHydrated) {
    return (
      <div
        className="h-96 animate-pulse rounded-2xl bg-card"
        aria-busy="true"
        aria-label="Loading appearance settings"
      />
    );
  }

  return (
    <div className="space-y-6">
      <section className="card-surface density-pad">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium">Accent</h2>
            <p className="text-xs text-muted-foreground">
              Drives every button, link, focus ring and active state.
            </p>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-muted-foreground"
            onClick={reset}
          >
            Reset
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {PALETTES.map((palette) => {
            const isActive = customHue === null && palette.id === paletteId;

            return (
              <button
                key={palette.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => setPalette(palette.id)}
                title={palette.description}
                className={cn(
                  "group relative overflow-hidden rounded-xl border p-3 text-left transition-all duration-200",
                  isActive
                    ? "border-primary/60 shadow-lift"
                    : "border-border hover:-translate-y-px hover:shadow-lift",
                )}
              >
                {/*
                  The tile wears the palette it is offering. A row of grey
                  buttons with small coloured dots makes you read the labels to
                  choose; this lets you point at the one you want.
                */}
                <span
                  aria-hidden="true"
                  className="absolute inset-0 -z-10 opacity-90 transition-opacity group-hover:opacity-100"
                  style={{
                    background: `linear-gradient(140deg, ${swatchColor(
                      palette.hue,
                      palette.chroma * 0.9,
                    )} 0%, color-mix(in oklch, ${swatchColor(
                      palette.hue,
                      palette.chroma,
                    )} 22%, var(--card)) 70%)`,
                  }}
                />

                <span className="flex h-12 flex-col justify-between">
                  <span className="flex items-start justify-between gap-1">
                    <span
                      aria-hidden="true"
                      className="size-4 rounded-full ring-2 ring-white/25"
                      style={{
                        background: swatchColor(palette.hue, palette.chroma),
                      }}
                    />
                    {isActive ? (
                      <span className="flex size-4 items-center justify-center rounded-full bg-white/90">
                        <CheckIcon className="size-3 text-black" />
                      </span>
                    ) : null}
                  </span>

                  <span className="block truncate text-xs font-semibold text-white drop-shadow-sm">
                    {palette.name}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {/*
          A hue slider rather than a colour input. A free hex lets someone pick
          a pale yellow for a button that carries white text; taking the hue and
          re-deriving lightness in CSS means every colour on this slider is
          legible by construction. It is a smaller promise, honestly kept.
        */}
        <div className="mt-4 space-y-2 border-t pt-4">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="custom-hue" className="text-sm font-medium">
              Custom colour
            </Label>

            {customHue !== null ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground"
                onClick={() => setCustomHue(null)}
              >
                Use a preset
              </Button>
            ) : null}
          </div>

          <input
            id="custom-hue"
            type="range"
            min={0}
            max={360}
            step={1}
            value={customHue ?? 272}
            onChange={(event) => setCustomHue(Number(event.target.value))}
            aria-label="Accent hue"
            className="h-2 w-full cursor-pointer appearance-none rounded-full"
            style={{
              background:
                "linear-gradient(to right, oklch(0.62 0.16 0), oklch(0.62 0.16 60), oklch(0.62 0.16 120), oklch(0.62 0.16 180), oklch(0.62 0.16 240), oklch(0.62 0.16 300), oklch(0.62 0.16 360))",
            }}
          />

          {customHue !== null ? (
            <div className="flex items-center gap-3 pt-1">
              <Label
                htmlFor="custom-chroma"
                className="shrink-0 text-xs text-muted-foreground"
              >
                Intensity
              </Label>
              <input
                id="custom-chroma"
                type="range"
                min={0}
                max={0.2}
                step={0.01}
                value={customChroma}
                onChange={(event) =>
                  setCustomChroma(Number(event.target.value))
                }
                aria-label="Accent intensity"
                className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-surface"
              />
            </div>
          ) : null}
        </div>
      </section>

      <section className="card-surface density-pad space-y-5">
        <Segmented
          label="Mode"
          description="Follow the system, or pin it."
          value={(theme ?? "system") as "light" | "dark" | "system"}
          onChange={setTheme}
          options={[
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
            { value: "system", label: "System" },
          ]}
        />

        <Segmented
          label="Density"
          description="How much air the interface has. Text size does not change."
          value={density}
          onChange={setDensity}
          options={DENSITIES.map((value) => ({
            value,
            label: DENSITY_LABELS[value],
          }))}
        />

        <Segmented
          label="Cards"
          description="How panels separate from the page — a border, a shadow, or frosted glass."
          value={surface}
          onChange={setSurface}
          options={SURFACES.map((value) => ({
            value,
            label: SURFACE_LABELS[value],
          }))}
        />

        <Segmented
          label="Background"
          description="A wash of your accent behind the page."
          value={gradient}
          onChange={setGradient}
          options={GRADIENTS.map((value) => ({
            value,
            label: GRADIENT_LABELS[value],
          }))}
        />

        <div className="flex items-start justify-between gap-4 border-t pt-4">
          <div>
            <p className="text-sm font-medium">Visual effects</p>
            <p className="text-xs text-muted-foreground">
              Accent glows and decorative flourishes. Turning this off never
              affects motion you have already disabled in your operating
              system — that setting always wins.
            </p>
          </div>

          <Switch
            checked={effects}
            onCheckedChange={setEffects}
            aria-label="Visual effects"
          />
        </div>
      </section>

      {/*
        A real board column, not a row of loose buttons.
        Every setting on this page is judged by what the board looks like, so
        the preview shows the thing being judged: the same card surface, the
        same priority wash, the same density and radius. Swatches on their own
        answer "is this colour nice"; this answers "do I want to work in it".
      */}
      <section className="card-surface density-pad">
        <div className="mb-3 flex items-center gap-2">
          <SparklesIcon
            className="size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <h2 className="text-sm font-medium">Preview</h2>
          <span className="text-xs text-muted-foreground">
            The board, as you have it set
          </span>
        </div>

        <div className="rounded-2xl bg-surface p-3">
          <div className="mb-2.5 flex items-center gap-2 px-1">
            <span className="text-xs font-medium">In progress</span>
            <span className="rounded bg-accent px-1.5 text-[0.6875rem] tabular-nums text-muted-foreground">
              3
            </span>
          </div>

          <div className="space-y-2">
            {PREVIEW_CARDS.map((card) => (
              <article
                key={card.title}
                data-priority={card.priority}
                style={
                  {
                    "--priority-accent": `var(--priority-${card.priority})`,
                  } as React.CSSProperties
                }
                className="card-surface card-interactive priority-tint p-3"
              >
                <p className="text-sm leading-snug">{card.title}</p>
                <div className="mt-2 flex items-center gap-2 text-[0.6875rem] text-muted-foreground">
                  <span className="rounded px-1.5 py-0.5 text-brand ring-1 ring-current/25">
                    {card.label}
                  </span>
                  <span>{card.meta}</span>
                  <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-primary text-[0.5625rem] font-semibold text-primary-foreground">
                    JK
                  </span>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          <Button size="sm">Primary</Button>
          <Button size="sm" variant="outline">
            Outline
          </Button>
          <Button size="sm" variant="ghost">
            Ghost
          </Button>
          <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-brand">
            Accent chip
          </span>
        </div>
      </section>
    </div>
  );
}
