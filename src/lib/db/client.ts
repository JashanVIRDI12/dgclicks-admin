import "server-only";

import { MongoClient, type Db } from "mongodb";

import { env } from "@/lib/env";

/**
 * The one MongoClient in the process.
 *
 * Better Auth's Mongo adapter needs a `Db` synchronously at module load, while
 * Mongoose connects asynchronously. Rather than run two pools against the same
 * cluster, this module owns the client and `connect.ts` adopts it into Mongoose.
 *
 * `new MongoClient()` does not open a socket — the driver connects lazily on the
 * first command — so `client.db()` is safe to call here at import time.
 */

/**
 * Resolves the database name into the connection string itself.
 *
 * This matters more than it looks: Mongoose's `setClient()` takes the database
 * from `client.s.options.dbName` (i.e. the URI path) and ignores any name passed
 * to `client.db()`. If MONGODB_DB_NAME were applied only on the Better Auth
 * side, auth collections would land in one database and Mongoose models in
 * another, silently. Folding the name into the URI makes both paths resolve to
 * the same database by construction.
 */
function resolveConnectionString(): { uri: string; dbName: string } {
  // Parsed by hand rather than with `new URL()`. A seed-list connection string
  // — `mongodb://a:27017,b:27017,c:27017/?replicaSet=rs0`, which is what Atlas
  // hands out for its non-SRV form and what every self-hosted replica set uses
  // — is a valid MongoDB URI but not a valid WHATWG URL: the commas in the host
  // list make `new URL()` throw. `env.ts` accepts any `mongodb…` string, so
  // that combination crashed the process at import with a bare "Invalid URL"
  // and a stack pointing at the auth layer.
  const schemeEnd = env.MONGODB_URI.indexOf("://");

  if (schemeEnd === -1) {
    throw new Error(
      "MONGODB_URI must start with mongodb:// or mongodb+srv://.",
    );
  }

  const scheme = env.MONGODB_URI.slice(0, schemeEnd + 3);
  const rest = env.MONGODB_URI.slice(schemeEnd + 3);

  // A password may legally contain `/` and `?` once percent-encoded, but never
  // an unescaped `@` — so the authority ends at the *last* one.
  const credentialsEnd = rest.lastIndexOf("@");
  const credentials =
    credentialsEnd === -1 ? "" : rest.slice(0, credentialsEnd + 1);
  const authority = rest.slice(credentialsEnd + 1);

  const queryStart = authority.indexOf("?");
  const query = queryStart === -1 ? "" : authority.slice(queryStart);
  const hostsAndPath =
    queryStart === -1 ? authority : authority.slice(0, queryStart);

  const pathStart = hostsAndPath.indexOf("/");
  const hosts = pathStart === -1 ? hostsAndPath : hostsAndPath.slice(0, pathStart);
  const uriDbName = pathStart === -1 ? "" : hostsAndPath.slice(pathStart + 1);

  const dbName = env.MONGODB_DB_NAME ?? (uriDbName || undefined);

  if (!dbName) {
    throw new Error(
      "No database name found. Either set MONGODB_DB_NAME or include the database in MONGODB_URI (e.g. mongodb+srv://.../dgclicks).",
    );
  }

  return { uri: `${scheme}${credentials}${hosts}/${dbName}${query}`, dbName };
}

const { uri, dbName } = resolveConnectionString();

/**
 * Cached on `globalThis` because the dev server re-evaluates modules on every
 * hot reload; without this each edit would leak a connection pool.
 */
const globalForMongo = globalThis as unknown as {
  __mongoClient?: MongoClient;
};

export const mongoClient: MongoClient =
  globalForMongo.__mongoClient ??
  new MongoClient(uri, {
    // Keep the pool modest: dev reloads and serverless instances can otherwise
    // exhaust the Atlas connection limit.
    maxPoolSize: 10,
    minPoolSize: 0,
    retryWrites: true,
  });

if (!env.isProduction) {
  globalForMongo.__mongoClient = mongoClient;
}

/** Database handle used by Better Auth. Resolved from the URI, see above. */
export const mongoDb: Db = mongoClient.db();

/** Exposed for the health check and diagnostics. */
export const databaseName = dbName;
