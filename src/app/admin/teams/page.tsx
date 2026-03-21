import {
  createTeamAction,
  deleteTeamAction,
  updateTeamAction,
} from "@/app/admin/_actions/actions";
import { TeamOwnerPasswordResetForm } from "@/components/admin/team-owner-password-reset-form";
import { Panel } from "@/components/ui/panel";
import { getAuctionSetupStatus } from "@/server/admin/settings-service";
import { listTeams } from "@/server/teams/team-service";

export default async function TeamsPage() {
  const teams = await listTeams();
  const setup = await getAuctionSetupStatus();

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <Panel title="Create team" eyebrow="Teams">
        <form action={createTeamAction} className="grid gap-4">
          <input className="rounded-2xl border border-slate-200 px-4 py-3" name="name" placeholder="Team name" required />
          <input className="rounded-2xl border border-slate-200 px-4 py-3 uppercase" name="shortCode" placeholder="Short code" required />
          <button className="rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white" type="submit">
            Add team
          </button>
          <p className="text-sm text-slate-500">
            {setup.configuredTeams}/{setup.configuredTeams + setup.missingTeamSlots} teams configured.
            Add each team here, then generate invite links from the invites page.
          </p>
        </form>
      </Panel>
      <Panel title="Registered teams" eyebrow="Roster">
        <div className="grid gap-3">
          {teams.map((team) => (
            <div
              key={team.id}
              className={`rounded-2xl border px-4 py-3 text-sm ${
                team.owner
                  ? "border-turf/25 bg-[linear-gradient(135deg,rgba(12,135,94,0.10),rgba(255,255,255,0.96))] text-slate-800"
                  : "border-amber/30 bg-[linear-gradient(135deg,rgba(245,158,11,0.12),rgba(255,255,255,0.96))] text-slate-800"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">{team.name}</span>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${
                      team.owner
                        ? "bg-turf text-white"
                        : "bg-amber text-white"
                    }`}
                  >
                    {team.owner ? "Onboarded" : "Pending"}
                  </span>
                  <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
                    {team.shortCode}
                  </span>
                </div>
              </div>
              <div className="mt-2 text-xs text-slate-600">
                Owner: {team.owner?.displayName ?? "Awaiting invite redemption"}
                {team.owner?.email ? ` • ${team.owner.email}` : ""}
                {" • "}Players: {team.rosterEntries.length}
              </div>
              <div className="mt-4 grid gap-3 rounded-2xl border border-white/70 bg-white/70 p-3">
                <form action={updateTeamAction} className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_140px_auto]">
                  <input name="teamId" type="hidden" value={team.id} />
                  <input
                    className="rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                    defaultValue={team.name}
                    name="name"
                    required
                  />
                  <input
                    className="rounded-2xl border border-slate-200 px-4 py-3 text-sm uppercase"
                    defaultValue={team.shortCode}
                    name="shortCode"
                    required
                  />
                  <button
                    className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    type="submit"
                  >
                    Save
                  </button>
                </form>
                <form action={deleteTeamAction} className="flex justify-end">
                  <input name="teamId" type="hidden" value={team.id} />
                  <button
                    className="rounded-2xl border border-rose/30 bg-rose/10 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose/15"
                    type="submit"
                  >
                    Remove team
                  </button>
                </form>
                {team.owner ? (
                  <TeamOwnerPasswordResetForm
                    ownerName={team.owner.displayName}
                    teamId={team.id}
                    teamName={team.name}
                  />
                ) : null}
                <p className="text-xs text-slate-500">
                  Teams can be renamed at any time. Removal is only allowed before invites, owners, bids, or roster history are attached. Password resets immediately sign the owner out from active sessions.
                </p>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
