import { getEnv } from "@/lib/env/server";
import { InviteGeneratorForm } from "@/components/admin/invite-generator-form";
import { Panel } from "@/components/ui/panel";
import { listTeams } from "@/server/teams/team-service";

export default async function InvitesPage() {
  const env = getEnv();
  const teams = await listTeams();
  const inviteEligibleTeams = teams.filter((team) => !team.ownerId);

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <Panel title="Create invite" eyebrow="Onboarding">
        <div className="grid gap-4">
          <div className="rounded-[1.5rem] border border-turf/20 bg-[linear-gradient(135deg,rgba(12,135,94,0.12),rgba(255,255,255,0.96))] px-5 py-4 text-sm text-slate-700">
            <div className="text-xs font-bold uppercase tracking-[0.22em] text-turf">
              Invite flow
            </div>
            <div className="mt-2 leading-6">
              Generate a one-time team-bound link, share it with the owner, and the latest pending invite becomes the active one for that team.
            </div>
          </div>
          <InviteGeneratorForm
            submitLabel="Generate invite"
            teams={inviteEligibleTeams.map((team) => ({
              id: team.id,
              name: team.name,
            }))}
          />
        </div>
      </Panel>
      <Panel title="Latest invite status" eyebrow="Teams">
        <div className="grid gap-3">
          {teams.map((team) => {
            const invite = team.invites[0];
            return (
              <div
                key={team.id}
                className={`rounded-2xl border px-4 py-3 text-sm ${
                  team.owner
                    ? "border-turf/25 bg-[linear-gradient(135deg,rgba(12,135,94,0.10),rgba(255,255,255,0.96))] text-slate-800"
                    : invite
                      ? "border-amber/30 bg-[linear-gradient(135deg,rgba(245,158,11,0.10),rgba(255,255,255,0.96))] text-slate-800"
                      : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{team.name}</span>
                  <span
                    className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${
                      team.owner
                        ? "bg-turf text-white"
                        : invite
                          ? "bg-amber text-white"
                          : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {team.owner ? "Onboarded" : invite?.status ?? "No invite"}
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {team.owner
                    ? `Owner assigned: ${team.owner.displayName}`
                    : invite
                      ? `Expires ${invite.expiresAt.toLocaleString()}`
                      : "No invite created yet"}
                </div>
                {invite ? (
                  <div className="mt-2 break-all text-xs text-turf">
                    {env.APP_URL}/invite/{invite.publicToken}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
