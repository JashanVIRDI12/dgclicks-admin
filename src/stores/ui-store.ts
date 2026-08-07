import { create } from "zustand";
import { persist } from "zustand/middleware";

type UiState = {
  /** Desktop sidebar collapsed to icons only. */
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  /** Mobile sheet nav. Deliberately not persisted. */
  isMobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;

  /**
   * Cmd/Ctrl+K palette. Lives here rather than in the palette itself so the
   * topbar button and the keyboard shortcut drive the same piece of state
   * without either owning the other.
   */
  isCommandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;

  /** Global workspace assistant panel. Deliberately not persisted. */
  isAssistantOpen: boolean;
  setAssistantOpen: (open: boolean) => void;

  /**
   * A prompt handed to the panel by an "Ask AI" button elsewhere in the app.
   *
   * The counter, not the text, is what marks a prompt as new: picking the same
   * action twice must refill a composer the reader has since cleared, and
   * comparing the text alone would treat the second click as a no-op.
   */
  assistantPrompt: { id: number; text: string } | null;
  askAssistant: (text: string) => void;
};

/**
 * Chrome state that belongs to the browser, not the server: sidebar collapse,
 * the mobile nav sheet, and the command palette.
 *
 * Application data lives in TanStack Query — this store is only for UI that no
 * one else needs to know about, which keeps it from turning into a second,
 * competing cache.
 */
export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      isSidebarCollapsed: false,
      toggleSidebar: () =>
        set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
      setSidebarCollapsed: (isSidebarCollapsed) => set({ isSidebarCollapsed }),

      isMobileNavOpen: false,
      setMobileNavOpen: (isMobileNavOpen) => set({ isMobileNavOpen }),

      isCommandPaletteOpen: false,
      setCommandPaletteOpen: (isCommandPaletteOpen) =>
        set({ isCommandPaletteOpen }),

      isAssistantOpen: false,
      setAssistantOpen: (isAssistantOpen) => set({ isAssistantOpen }),

      assistantPrompt: null,
      askAssistant: (text) =>
        set((state) => ({
          isAssistantOpen: true,
          assistantPrompt: { id: (state.assistantPrompt?.id ?? 0) + 1, text },
        })),
    }),
    {
      name: "dgclicks.ui",
      // Only the collapse preference survives a reload; a mobile sheet or a
      // palette that reopened itself on every visit would be a bug, not a
      // feature.
      partialize: (state) => ({
        isSidebarCollapsed: state.isSidebarCollapsed,
      }),
    },
  ),
);
