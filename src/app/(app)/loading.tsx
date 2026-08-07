import { ModifiedClassicLoader } from "@/components/ui/modified-classic-loader";

export default function AppLoading() {
  return (
    <div className="flex min-h-[40svh] items-center justify-center">
      <ModifiedClassicLoader label="Loading workspace" />
    </div>
  );
}
