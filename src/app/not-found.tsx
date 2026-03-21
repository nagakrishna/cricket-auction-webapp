import Link from "next/link";

import { Shell } from "@/components/layout/shell";
import { Panel } from "@/components/ui/panel";

export default function NotFoundPage() {
  return (
    <Shell
      title="Page not found"
      description="The link may have expired, been removed, or never existed."
    >
      <div className="mx-auto max-w-xl">
        <Panel title="Nothing to show here" eyebrow="404">
          <p className="text-sm text-slate-600">
            If you were opening an invite, ask the admin for a new one.
          </p>
          <Link className="mt-4 inline-flex rounded-full bg-ink px-4 py-2 text-sm text-white" href="/">
            Back to overview
          </Link>
        </Panel>
      </div>
    </Shell>
  );
}
