import { MongoClient } from "mongodb";

/**
 * Moves every task from the single `assignee` field to the `assignees` array.
 *
 * Tasks used to belong to one person. They can now belong to several, and the
 * field that held the old owner is gone from the schema — so until this runs,
 * existing tasks have their owner in a field nothing writes to any more.
 *
 * `toTask` in `features/tasks/server/serialize.ts` reads the old field as a
 * fallback, so the app renders those tasks correctly in the meantime. What it
 * cannot do is make them *queryable*: "my tasks", the dashboard counts, the
 * workload report and the per-person aggregation all filter on `assignees`, and
 * an un-migrated task is invisible to every one of them. That is what this
 * fixes, and why it should be run before anyone relies on those screens again.
 *
 *   npm run db:migrate-assignees              # dry run: reports what would change
 *   npm run db:migrate-assignees -- --confirm # actually writes
 *
 * Safe to run twice. The filter only matches documents that still have the old
 * field, so a second pass finds nothing to do.
 *
 * Reads MONGODB_URI and MONGODB_DB_NAME from .env.local via `node --env-file`.
 */

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME;

if (!uri) {
  console.error("MONGODB_URI is not set. Run this through npm, not directly.");
  process.exit(1);
}

const confirmed = process.argv.includes("--confirm");
const client = new MongoClient(uri);

try {
  await client.connect();

  const tasks = client.db(dbName).collection("task");

  // Only documents the migration has not already reached.
  const pending = { assignee: { $exists: true } };

  const [total, withOwner] = await Promise.all([
    tasks.countDocuments(pending),
    tasks.countDocuments({ assignee: { $exists: true, $ne: null } }),
  ]);

  console.log(`tasks carrying the old field: ${total}`);
  console.log(`  of those, actually assigned: ${withOwner}`);
  console.log(`  unassigned (empty array):    ${total - withOwner}`);

  if (total === 0) {
    console.log("\nNothing to migrate.");
  } else if (!confirmed) {
    console.log("\nDry run. Re-run with --confirm to write.");
  } else {
    /*
      One pipeline update rather than a read-modify-write loop: the value being
      written is derived from the document itself, so letting the server do it
      keeps the whole migration to a single round trip and leaves no window in
      which a concurrent write could be overwritten by a stale copy.
    */
    const result = await tasks.updateMany(pending, [
      {
        $set: {
          assignees: {
            $cond: [
              { $ifNull: ["$assignee", false] },
              ["$assignee"],
              { $ifNull: ["$assignees", []] },
            ],
          },
        },
      },
      { $unset: "assignee" },
    ]);

    console.log(`\nmigrated: ${result.modifiedCount}`);

    const remaining = await tasks.countDocuments(pending);
    console.log(`remaining with the old field: ${remaining}`);
  }
} finally {
  await client.close();
}
