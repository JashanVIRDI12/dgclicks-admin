import {
  BarChart3Icon,
  CameraIcon,
  CodeIcon,
  LayoutGridIcon,
  type LucideIcon,
  MegaphoneIcon,
  PaletteIcon,
  PenToolIcon,
  RocketIcon,
  SearchIcon,
  Settings2Icon,
  TargetIcon,
  UserIcon,
} from "lucide-react";

import type { BoardIcon as BoardIconName } from "@/features/tasks/constants";
import { cn } from "@/lib/utils";

/**
 * Resolves a stored icon name to a component.
 *
 * The name is what lives in the database — a board picked "search", not a React
 * component — so this map is the only place the two are tied together, and
 * lucide stays out of the server bundle that reads boards.
 */
export const BOARD_ICON_COMPONENTS: Record<BoardIconName, LucideIcon> = {
  layout: LayoutGridIcon,
  search: SearchIcon,
  code: CodeIcon,
  palette: PaletteIcon,
  megaphone: MegaphoneIcon,
  pen: PenToolIcon,
  camera: CameraIcon,
  chart: BarChart3Icon,
  rocket: RocketIcon,
  target: TargetIcon,
  settings: Settings2Icon,
  user: UserIcon,
};

/**
 * A board's icon in its own colour, on a tint of the same colour.
 *
 * The tint is derived with `color-mix` from the one `--label-*` token rather
 * than stored as a second value, so light and dark stay in step automatically.
 */
export function BoardIcon({
  icon,
  color,
  className,
}: {
  icon: BoardIconName;
  color: string;
  className?: string;
}) {
  const Icon = BOARD_ICON_COMPONENTS[icon];

  return (
    <span
      className={cn(
        "chip-tinted flex size-9 shrink-0 items-center justify-center rounded-xl",
        className,
      )}
      style={{ "--chip-color": `var(--label-${color})` } as React.CSSProperties}
      aria-hidden="true"
    >
      <Icon className="size-[1.125rem]" />
    </span>
  );
}
