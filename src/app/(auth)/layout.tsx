import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { Brand } from "@/components/layout/brand";
import { getSession } from "@/features/auth/server/session";

/**
 * Shell for the signed-out screens.
 *
 * Bounces an already-authenticated user to the dashboard so the back button
 * cannot land them on a sign-in form they no longer need.
 */
export default async function AuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getSession();

  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Brand />
        </div>

        {children}
      </div>
    </div>
  );
}
