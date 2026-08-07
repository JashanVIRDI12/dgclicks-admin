/**
 * Fractional ordering for anything a user can drag: cards in a column, columns
 * on a board, items in a checklist.
 *
 * Pure arithmetic, deliberately not `server-only`: the board computes the same
 * midpoint locally for its optimistic update, and a card that jumps to a
 * different slot when the server responds is worse than no optimism at all.
 *
 * A dropped card takes a position midway between its new neighbours, so a move
 * writes one document instead of resequencing everything after it. That matters
 * on a board — with integer indices, dragging a card to the top of a fifty-card
 * column is fifty writes and fifty chances to race with someone else's drag.
 *
 * The cost is that repeatedly dropping into the same gap halves it each time,
 * and after roughly fifty consecutive inserts the midpoint stops being
 * representable. `needsRebalance` detects that before it happens, and callers
 * resequence the affected list.
 */

/** Gap between freshly seeded siblings. Large enough to subdivide for a long time. */
export const POSITION_STEP = 65_536;

/**
 * Below this, the next midpoint risks colliding with a neighbour. Well above
 * the point where doubles actually lose precision, so a rebalance happens while
 * the ordering is still correct rather than after it breaks.
 */
const MIN_GAP = 0.5;

/**
 * A position that sorts between two neighbours.
 *
 * `null` means "no neighbour on that side" — dropping at the very top or bottom
 * of a column, or into an empty one.
 */
export function positionBetween(
  before: number | null,
  after: number | null,
): number {
  if (before === null && after === null) {
    return POSITION_STEP;
  }

  if (before === null) {
    return (after as number) - POSITION_STEP;
  }

  if (after === null) {
    return before + POSITION_STEP;
  }

  return (before + after) / 2;
}

/** True when the gap the caller is about to subdivide is too small to survive. */
function needsRebalance(
  before: number | null,
  after: number | null,
): boolean {
  if (before === null || after === null) {
    return false;
  }

  return Math.abs(after - before) < MIN_GAP;
}

/** Evenly spaced positions for `count` siblings, used when seeding or rebalancing. */
export function sequentialPositions(count: number): number[] {
  return Array.from({ length: count }, (_, index) => (index + 1) * POSITION_STEP);
}

/** The position that appends to a list whose last member sits at `last`. */
export function positionAfter(last: number | null): number {
  return positionBetween(last, null);
}

/**
 * Resolves where a dropped item lands, rebalancing first if the gap is spent.
 *
 * Takes callbacks rather than a Mongoose model so this module stays free of the
 * database: boards, columns and cards all reorder identically, but each reads
 * from a different collection, and a shared generic over `Model<T>` collapses
 * into an uncallable union the moment two model types meet.
 *
 * The neighbours are re-read after a rebalance because resequencing moved them.
 */
export async function resolveDropPosition(options: {
  /** Current position of a sibling, or `null` if it has since been removed. */
  readPosition: (id: string) => Promise<number | null>;
  /** Rewrites every sibling to an evenly spaced sequence. */
  rebalance: () => Promise<void>;
  beforeId: string | null;
  afterId: string | null;
}): Promise<number> {
  async function readNeighbours(): Promise<[number | null, number | null]> {
    const [before, after] = await Promise.all([
      options.beforeId ? options.readPosition(options.beforeId) : null,
      options.afterId ? options.readPosition(options.afterId) : null,
    ]);

    return [before, after];
  }

  let [before, after] = await readNeighbours();

  if (needsRebalance(before, after)) {
    await options.rebalance();
    [before, after] = await readNeighbours();
  }

  return positionBetween(before, after);
}
