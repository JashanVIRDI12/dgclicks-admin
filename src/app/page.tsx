import { redirect } from "next/navigation";

import { getSession } from "@/features/auth/server/session";

/**
 * `/` is an entry point, not a page.
 *
 * The proxy already redirects here, but this repeats the decision server-side
 * so the root still resolves correctly if a request reaches it directly.
 */
export default async function RootPage() {
  const session = await getSession();

  redirect(session ? "/dashboard" : "/sign-in");
}
