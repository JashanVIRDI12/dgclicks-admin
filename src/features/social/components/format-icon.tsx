import {
  ClapperboardIcon,
  CircleDotIcon,
  FileTextIcon,
  GalleryHorizontalEndIcon,
  ImageIcon,
  PaletteIcon,
  Repeat2Icon,
  SquareIcon,
  VideoIcon,
  type LucideIcon,
} from "lucide-react";

import type { ContentFormat } from "@/features/social/constants";
import { cn } from "@/lib/utils";

/**
 * A glyph per content format.
 *
 * On a month grid the shape is what lets someone find every reel without
 * reading a word, so format is always drawn rather than only named — and the
 * name is still on the chip's tooltip and in the dialog, so the icon is never
 * the only thing carrying it.
 */
const FORMAT_ICONS: Record<ContentFormat, LucideIcon> = {
  post: SquareIcon,
  reel: ClapperboardIcon,
  story: CircleDotIcon,
  carousel: GalleryHorizontalEndIcon,
  video: VideoIcon,
  gif: Repeat2Icon,
  photo: ImageIcon,
  graphic: PaletteIcon,
  copy: FileTextIcon,
};

export function FormatIcon({
  format,
  className,
}: {
  format: ContentFormat;
  className?: string;
}) {
  const Icon = FORMAT_ICONS[format];

  return <Icon className={cn("size-3.5", className)} aria-hidden="true" />;
}
