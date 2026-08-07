import { MongoClient } from "mongodb";

/**
 * One-off teardown for the CRM that the Tasks module replaced.
 *
 * The application code for clients, tags, notes and service departments is gone;
 * this removes the data those modules left behind. It is deliberately a separate,
 * opt-in script rather than part of a migration that runs on boot — dropping
 * collections is not reversible, and it should happen because someone decided to
 * run it, not as a side effect of a deploy.
 *
 *   npm run db:drop-crm              # dry run: reports what would go
 *   npm run db:drop-crm -- --confirm # actually drops
 *
 * Reads MONGODB_URI and MONGODB_DB_NAME from .env.local via `node --env-file`.
 */

/** Collections owned solely by the removed CRM and departments modules. */
const COLLECTIONS = ["client", "tag", "note", "department"] as const;

/**
 * Entity types the current Activity feed knows how to render. Anything else in
 * the collection was written by a module that no longer exists, so its entries
 * would render as unlinkable prose about records that are being deleted below.
 */
const LIVE_ENTITY_TYPES = [
  "workspace",
  "board",
  "list",
  "task",
  "comment",
  "attachment",
];

function resolveConnection(): { uri: string; dbName: string } {
  const rawUri = process.env.MONGODB_URI;

  if (!rawUri) {
    throw new Error(
      "MONGODB_URI is not set. Run via `npm run db:drop-crm`, which loads .env.local.",
    );
  }

  // Mirrors lib/db/client.ts: the database name belongs in the URI path so both
  // the driver and Mongoose resolve to the same database.
  const url = new URL(rawUri);
  const dbName = process.env.MONGODB_DB_NAME ?? url.pathname.replace(/^\//, "");

  if (!dbName) {
    throw new Error(
      "No database name found. Set MONGODB_DB_NAME or include the database in MONGODB_URI.",
    );
  }

  url.pathname = `/${dbName}`;
  return { uri: url.toString(), dbName };
}

async function main(): Promise<void> {
  const isConfirmed = process.argv.includes("--confirm");
  const { uri, dbName } = resolveConnection();
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db();

    const existing = new Set(
      (await db.listCollections({}, { nameOnly: true }).toArray()).map(
        (collection) => collection.name,
      ),
    );

    console.log(`Database: ${dbName}\n`);

    const present = COLLECTIONS.filter((name) => existing.has(name));

    for (const name of COLLECTIONS) {
      if (!existing.has(name)) {
        console.log(`  ${name.padEnd(12)} — not present`);
        continue;
      }

      const count = await db.collection(name).countDocuments();
      console.log(`  ${name.padEnd(12)} ${count} document(s)`);
    }

    const staleActivityFilter = {
      entityType: { $nin: LIVE_ENTITY_TYPES },
    };
    const staleActivity = existing.has("activity")
      ? await db.collection("activity").countDocuments(staleActivityFilter)
      : 0;

    console.log(`  ${"activity".padEnd(12)} ${staleActivity} stale entry/entries`);

    if (!isConfirmed) {
      console.log(
        "\nDry run — nothing was deleted." +
          "\nRe-run with `npm run db:drop-crm -- --confirm` to drop the above.",
      );
      return;
    }

    console.log("\nDropping…");

    for (const name of present) {
      await db.dropCollection(name);
      console.log(`  dropped ${name}`);
    }

    if (staleActivity > 0) {
      const result = await db
        .collection("activity")
        .deleteMany(staleActivityFilter);
      console.log(`  removed ${result.deletedCount} activity entry/entries`);
    }

    console.log("\nDone.");
  } finally {
    await client.close();
  }
}

await main();
