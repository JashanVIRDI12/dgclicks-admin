import { withRoute } from "@/lib/api/handler";
import { mongoClient } from "@/lib/db/client";
import { connectToDatabase } from "@/lib/db/connect";

// Never prerendered: this must reflect the state of the process answering the
// request, not the state of the machine that ran the build.
export const dynamic = "force-dynamic";

/**
 * Liveness probe, and the regression test for the shared-connection design.
 *
 * Exercises both paths that depend on it — a raw driver ping and a Mongoose
 * call — and asserts they are backed by the same `MongoClient`. If
 * `Connection.setClient()` ever stops adopting our client, `sharedClient` flips
 * to false here rather than showing up later as two connection pools quietly
 * competing for the Atlas connection limit.
 *
 * Public by design so it can be polled by an uptime check before anyone signs
 * in. It reports booleans only — no database names, collections or topology.
 */
export const GET = withRoute({
  auth: false,
  handler: async () => {
    const startedAt = performance.now();

    // Driver path.
    await mongoClient.db().command({ ping: 1 });

    // Mongoose path: adopts the same client, then issues a real command
    // through it.
    const connection = await connectToDatabase();
    await connection.db?.command({ ping: 1 });

    return {
      status: "ok",
      database: {
        driver: true,
        mongoose: connection.readyState === 1,
        sharedClient: connection.getClient() === mongoClient,
      },
      latencyMs: Math.round(performance.now() - startedAt),
    };
  },
});
