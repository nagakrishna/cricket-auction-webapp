import { notFound } from "next/navigation";

import { Shell } from "@/components/layout/shell";
import { Panel } from "@/components/ui/panel";
import { getInviteByToken } from "@/server/invites/invite-service";
import { redeemInviteAction } from "@/app/(public)/invite/[token]/actions";

type InvitePageProps = {
  params: Promise<{ token: string }>;
};

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;
  const invite = await getInviteByToken(token);

  if (!invite) {
    notFound();
  }

  const isActive = invite.status === "PENDING";

  return (
    <Shell
      title="Activate team owner access"
      description="This invite is reserved for one team. Set your name, email, and password once, then use the standard sign-in page from then on."
    >
      <div className="mx-auto w-full max-w-2xl">
        <Panel title={invite.team.name} eyebrow="Invite">
          {isActive ? (
            <form action={redeemInviteAction} className="grid gap-4">
              <input name="token" type="hidden" value={token} />
              <div className="rounded-[1.5rem] border border-turf/20 bg-[linear-gradient(135deg,rgba(12,135,94,0.12),rgba(255,255,255,0.96))] px-5 py-4 text-sm text-slate-700">
                <div className="text-xs font-bold uppercase tracking-[0.22em] text-turf">
                  Team owner onboarding
                </div>
                <div className="mt-2 leading-6">
                  This link expires at {invite.expiresAt.toLocaleString()}. Once activated, you can return through the normal login page anytime.
                </div>
              </div>
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Your name
                <input
                  required
                  className="rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-turf"
                  name="displayName"
                  type="text"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Email
                <input
                  required
                  className="rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-turf"
                  name="email"
                  type="email"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Password
                <input
                  required
                  className="rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-turf"
                  minLength={8}
                  name="password"
                  type="password"
                />
              </label>
              <button
                className="rounded-2xl bg-turf px-4 py-3 text-sm font-semibold text-white"
                type="submit"
              >
                Activate owner account
              </button>
            </form>
          ) : (
            <div className="rounded-[1.5rem] border border-rose/30 bg-rose/10 px-5 py-4 text-sm text-rose">
              <div className="text-xs font-bold uppercase tracking-[0.22em]">Invite unavailable</div>
              <div className="mt-2 leading-6">
                This invite is no longer active. Ask the admin to generate a fresh one for this team.
              </div>
            </div>
          )}
        </Panel>
      </div>
    </Shell>
  );
}
