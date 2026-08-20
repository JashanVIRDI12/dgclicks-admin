import {
  ArchiveIcon,
  BarChart3Icon,
  BookOpenIcon,
  CalendarDaysIcon,
  CircleUserIcon,
  ClapperboardIcon,
  HistoryIcon,
  LayoutDashboardIcon,
  LayoutGridIcon,
  SettingsIcon,
  type LucideIcon,
} from "lucide-react";
import type { Route } from "next";

/**
 * A single destination in the app. `description` and `keywords` exist so the
 * Cmd+K palette can index this same registry rather than maintaining a second,
 * drift-prone list of destinations.
 */
export type NavItem = {
  readonly title: string;
  readonly href: Route;
  readonly icon: LucideIcon;
  readonly description?: string;
  readonly keywords?: readonly string[];
};

export type NavSection = {
  readonly id: string;
  /** Rendered as a group heading; omit for the primary, unlabelled group. */
  readonly label?: string;
  readonly items: readonly NavItem[];
};

/**
 * The sidebar renders from this array. `href` is typed against the routes that
 * actually exist, so a link to a page that has not been created yet will not
 * compile — which is what catches nav drift when a route is renamed.
 */
export const navigation: readonly NavSection[] = [
  {
    id: "work",
    items: [
      {
        title: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboardIcon,
        description: "What needs attention today",
        keywords: ["home", "overview", "start", "today"],
      },
      {
        title: "My Tasks",
        href: "/my-tasks",
        icon: CircleUserIcon,
        description: "Everything assigned to you",
        keywords: ["mine", "assigned", "inbox", "todo"],
      },
      {
        title: "Boards",
        href: "/boards",
        icon: LayoutGridIcon,
        description: "Every team and workflow",
        keywords: ["kanban", "projects", "teams", "columns"],
      },
      {
        title: "Calendar",
        href: "/calendar",
        icon: CalendarDaysIcon,
        description: "Deadlines across every board",
        keywords: ["schedule", "dates", "month", "due"],
      },
      {
        title: "Content",
        href: "/content",
        icon: ClapperboardIcon,
        description: "Every client's posts, and whose artwork is outstanding",
        keywords: [
          "social",
          "posts",
          "media",
          "reel",
          "instagram",
          "clients",
          "artwork",
          "designer",
        ],
      },
    ],
  },
  {
    id: "workspace",
    label: "Workspace",
    items: [
      {
        title: "Activity",
        href: "/activity",
        icon: HistoryIcon,
        description: "What changed, and who changed it",
        keywords: ["history", "audit", "log", "timeline", "changes"],
      },
      {
        title: "Archive",
        href: "/archive",
        icon: ArchiveIcon,
        description: "Finished work, and anything you put away",
        keywords: ["archived", "completed", "done", "finished", "restore"],
      },
      {
        title: "Reports",
        href: "/reports",
        icon: BarChart3Icon,
        description: "Throughput, workload and what is late",
        keywords: ["stats", "analytics", "metrics", "insights", "progress"],
      },
      {
        title: "Settings",
        href: "/settings",
        icon: SettingsIcon,
        description: "Workspace members and your account",
        keywords: ["members", "people", "account", "password", "preferences"],
      },
      {
        title: "How it works",
        href: "/tutorial",
        icon: BookOpenIcon,
        description: "A short guide to boards, repeats and shortcuts",
        keywords: ["help", "guide", "tutorial", "docs", "shortcuts", "learn"],
      },
    ],
  },
];

/** Flattened view for consumers that do not care about grouping. */
export const navItems: readonly NavItem[] = navigation.flatMap(
  (section) => section.items,
);

/**
 * Matches the current pathname to a nav entry. Exact match for the root of a
 * section, prefix match for its children, so `/boards/123` still highlights
 * "Boards".
 */
export function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
