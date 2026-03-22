import { notFound } from "next/navigation";

import { InviteActivationForm } from "@/components/auth/invite-activation-form";
import { Shell } from "@/components/layout/shell";
import { Panel } from "@/components/ui/panel";
import { getInviteByToken } from "@/server/invites/invite-service";

type InvitePageProps = {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ error?: string }>;
};

function getInviteErrorMessage(error?: string) {
  switch (error) {
    case "invite_invalid":
      return "This invite could not be found. Ask the admin to generate a fresh link.";
    case "invite_expired":
      return "This invite has expired. Ask the admin to generate a fresh link.";
    case "invite_inactive":
      return "This invite is no longer active. Ask the admin to generate a fresh link.";
    case "team_claimed":
      return "This team already has an owner account.";
    case "email_in_use":
      return "That email address is already in use.";
    case "activation_failed":
      return "We could not activate this owner account. Please try again.";
    default:
      return null;
  }
}

export default async function InvitePage({ params, searchParams }: InvitePageProps) {
  const { token } = await params;
  const resolvedSearchParams = await searchParams;
  const invite = await getInviteByToken(token);

  if (!invite) {
    notFound();
  }

  const isActive = invite.status === "PENDING";
  const errorMessage = getInviteErrorMessage(resolvedSearchParams?.error);

  return (
    <Shell
      title="Activate team owner access"
      description="This invite is reserved for one team. Set your name, email, and password once, then use the standard sign-in page from then on."
    >
      <div className="mx-auto w-full max-w-2xl">
        <Panel title={invite.team.name} eyebrow="Invite">
          {isActive ? (
            <div className="grid gap-4">
              <div className="rounded-[1.5rem] border border-turf/20 bg-[linear-gradient(135deg,rgba(12,135,94,0.12),rgba(255,255,255,0.96))] px-5 py-4 text-sm text-slate-700">
                <div className="text-xs font-bold uppercase tracking-[0.22em] text-turf">
                  Team owner onboarding
                </div>
                <div className="mt-2 leading-6">
                  This link expires at {invite.expiresAt.toLocaleString()}. Once activated, you can return through the normal login page anytime.
                </div>
              </div>
              {errorMessage ? (
                <div className="rounded-[1.5rem] border border-rose/30 bg-rose/10 px-5 py-4 text-sm text-rose">
                  <div className="text-xs font-bold uppercase tracking-[0.22em]">Activation failed</div>
                  <div className="mt-2 leading-6">{errorMessage}</div>
                </div>
              ) : null}
              <InviteActivationForm token={token} />
            </div>
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
