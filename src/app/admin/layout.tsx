import { Shell } from "@/components/layout/shell";
import { Panel } from "@/components/ui/panel";
import { AdminNav } from "@/components/admin/admin-nav";
import { requireRole } from "@/lib/auth/session";

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireRole("ADMIN");

  return (
    <Shell
      title="Admin control center"
      description={
        <span className="flex flex-col gap-3">
          <span className="inline-flex w-fit items-center rounded-full bg-[linear-gradient(135deg,#081420,#17334a)] px-4 py-2 text-sm font-bold text-white shadow-[0_12px_24px_rgba(8,20,32,0.16)]">
            Signed in as {user.displayName}
          </span>
          <span>
            Manage setup, control the live auction, and handle interventions from one place.
          </span>
        </span>
      }
    >
      <Panel eyebrow="Navigation" className="space-y-4 border-slate-200/80 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.10),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))]">
        <div className="flex items-center justify-between gap-4">
          <AdminNav />
          <form action="/logout" method="POST">
            <button className="rounded-full border border-rose-200 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(255,241,242,0.96))] px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-rose-300 hover:bg-white" type="submit">
              Log out
            </button>
          </form>
        </div>
      </Panel>
      {children}
    </Shell>
  );
}
