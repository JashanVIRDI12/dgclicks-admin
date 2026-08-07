"use client";

import { SearchIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useUiStore } from "@/stores/ui-store";

/**
 * The visible way in to the palette.
 *
 * The shortcut is printed on it because a feature only reachable by a keystroke
 * nobody told you about is a feature most people never find.
 */
export function CommandPaletteTrigger() {
  const setOpen = useUiStore((state) => state.setCommandPaletteOpen);

  return (
    <Button
      variant="ghost"
      onClick={() => setOpen(true)}
      className="h-8 gap-2 px-2 text-muted-foreground hover:text-foreground"
    >
      <SearchIcon className="size-4" aria-hidden="true" />
      <span className="hidden sm:inline">Search</span>
      <kbd className="hidden rounded border px-1.5 py-0.5 font-sans text-[0.625rem] sm:inline">
        ⌘K
      </kbd>
    </Button>
  );
}
