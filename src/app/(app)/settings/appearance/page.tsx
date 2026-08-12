import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { FadeIn } from "@/components/common/fade-in";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/features/auth/server/session";
import { AppearancePanel } from "@/features/appearance/components/appearance-panel";

export const metadata: Metadata = {
  title: "Appearance",
};

/**
 * Appearance is per-device and lives entirely in the browser, so this page
 * needs no data — only a session, so it is not reachable signed out.
 */
export default async function AppearancePage() {
  await requireSession();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Theme and appearance"
        description="Make this workspace yours. Every change applies immediately and only on this device."
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href="/settings">
              <ArrowLeftIcon className="size-4" aria-hidden="true" />
              Settings
            </Link>
          </Button>
        }
      />

      <FadeIn>
        <AppearancePanel />
      </FadeIn>
    </div>
  );
}
