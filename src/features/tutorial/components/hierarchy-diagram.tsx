import { cn } from "@/lib/utils";

/**
 * The five nouns, drawn as the ladder they are.
 *
 * A list of definitions would say the same words, but the shape is the thing
 * people need: that a column is not a status field, and a subtask is a rung
 * below a task rather than a kind of checklist.
 */
const LEVELS = [
  {
    name: "Workspace",
    example: "DG Clicks",
    detail: "Who is in it, and which boards they can see.",
    color: "var(--label-purple)",
  },
  {
    name: "Board",
    example: "SEO",
    detail: "One team or workflow. Switch in the sidebar.",
    color: "var(--label-blue)",
  },
  {
    name: "Column",
    example: "In Progress",
    detail: "A stage. Drag cards between them.",
    color: "var(--label-teal)",
  },
  {
    name: "Task",
    example: "Monthly SEO report",
    detail: "A card. Click it to open the panel.",
    color: "var(--label-green)",
  },
  {
    name: "Subtask",
    example: "Pull Search Console data",
    detail: "Its own owner and deadline, inside a task.",
    color: "var(--label-amber)",
  },
];

export function HierarchyDiagram() {
  return (
    <ol className="space-y-1.5">
      {LEVELS.map((level, index) => (
        <li
          key={level.name}
          className="card-surface flex items-center gap-3 p-3"
          style={{ marginLeft: `${index * 1.25}rem` }}
        >
          <span
            className="chip-dot size-2.5 shrink-0 rounded-full"
            style={{ "--chip-color": level.color } as React.CSSProperties}
            aria-hidden="true"
          />

          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-sm font-medium">{level.name}</span>
              <span className="truncate text-xs text-muted-foreground">
                {level.example}
              </span>
            </p>
            <p
              className={cn(
                "mt-0.5 text-xs text-pretty text-muted-foreground",
                // The deepest rows get narrow on small screens; the detail is
                // the first thing worth dropping.
                index >= 3 && "hidden sm:block",
              )}
            >
              {level.detail}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
