import { Info } from "lucide-react";

import {
  createAuctionSeasonAction,
  createTeamAction,
  startAuctionAction,
  updateSettingsAction,
} from "@/app/admin/_actions/actions";
import { InviteGeneratorForm } from "@/components/admin/invite-generator-form";
import { StartAuctionButton } from "@/components/admin/start-auction-button";
import { Panel } from "@/components/ui/panel";
import { getEnv } from "@/lib/env/server";
import {
  getAuctionAdminData,
  getAuctionSetupStatus,
} from "@/server/admin/settings-service";
import { listParticipatingTeams, listTeams } from "@/server/teams/team-service";

export default async function AuctionSetupPage() {
  const env = getEnv();
  const auction = await getAuctionAdminData();
  const settings = auction.settings;
  const teams = await listParticipatingTeams();
  const allTeams = await listTeams();
  const setup = await getAuctionSetupStatus();
  const inviteEligibleTeams = allTeams.filter((team) => !team.ownerId);
  const participatingTeamIds = new Set(teams.map((team) => team.id));
  const ignoredTeams = allTeams.filter((team) => !participatingTeamIds.has(team.id));
  const ignoredOwnedTeams = ignoredTeams.filter((team) => team.ownerId);
  const checklistItems = [
    {
      key: "rules",
      title: "Rules and team count",
      description: `Auction rules are configured for ${settings.totalTeams} participating team${settings.totalTeams === 1 ? "" : "s"}.`,
      done: settings.totalTeams >= 2,
    },
    {
      key: "teams",
      title: "Team creation",
      description:
        setup.missingTeamSlots > 0
          ? `${setup.missingTeamSlots} more team slot${setup.missingTeamSlots === 1 ? "" : "s"} still need a team record.`
          : `All ${settings.totalTeams} participating teams are configured.`,
      done: setup.missingTeamSlots === 0,
    },
    {
      key: "owners",
      title: "Owner onboarding",
      description:
        setup.teamsMissingOwners > 0
          ? `${setup.teamsMissingOwners} configured team${setup.teamsMissingOwners === 1 ? "" : "s"} still need invite redemption.`
          : "Every participating team has an onboarded owner account.",
      done: setup.teamsMissingOwners === 0,
    },
    {
      key: "scope",
      title: "Participation scope",
      description:
        setup.excessOwnedTeams > 0
          ? `${setup.excessOwnedTeams} onboarded team${setup.excessOwnedTeams === 1 ? "" : "s"} currently sit outside the configured participating set.`
          : "No extra onboarded teams are blocking the auction start.",
      done: setup.excessOwnedTeams === 0,
    },
  ] as const;
  const checklistCompleteCount = checklistItems.filter((item) => item.done).length;
  const checklistHeadline = setup.canStart
    ? "Ready to launch"
    : setup.excessOwnedTeams > 0
      ? "Fix the participation mismatch"
      : "Complete the remaining setup steps";
  const checklistTone = setup.canStart
    ? "border-turf/30 bg-turf/10"
    : setup.excessOwnedTeams > 0
      ? "border-rose/30 bg-rose/10"
      : "border-amber/30 bg-amber/10";
  const checklistSummary = setup.auctionAlreadyStarted
    ? auction.status === "PAUSED"
      ? "This auction is already started and currently paused. Resume it from the live controls instead of starting again."
      : auction.status === "LIVE"
        ? "Random owner nomination order is ready and the auction is now live. Use the live controls to manage the room."
        : "This auction has already been completed. Create a new auction season to run another room."
    : setup.canStart
      ? "Everything required is in place. Starting the auction will generate the random owner nomination order and open the live room."
      : setup.excessOwnedTeams > 0
        ? `Setup mismatch: ${setup.excessOwnedTeams} extra onboarded team(s) exceed the configured total.`
        : `Setup incomplete: ${setup.missingTeamSlots} team slot(s) still need configuration and ${setup.teamsMissingOwners} configured team(s) still need owners.`;

  const settingsFields = [
    {
      name: "biddingTimerSeconds",
      value: auction.biddingTimerSeconds,
      min: 10,
      max: 300,
      label: "Bidding timer (seconds)",
      description: "How long a bidding round stays open before the current highest bid wins.",
    },
    {
      name: "selectionTimerSeconds",
      value: auction.selectionTimerSeconds,
      min: 10,
      max: 300,
      label: "Nomination timer (seconds)",
      description: "How long the current team owner has to nominate the next player for auction.",
    },
    {
      name: "snakeTimerSeconds",
      value: auction.snakeTimerSeconds,
      min: 10,
      max: 300,
      label: "Snake timer (seconds)",
      description: "How long each team gets to make its snake draft pick before auto-pick logic runs.",
    },
    {
      name: "auctionPlayers",
      value: auction.biddingRoundSize,
      min: 1,
      max: 50,
      label: "Bidding picks per team",
      description:
        "How many players each team wins in the bidding phase before snake draft begins. Total bidding picks = this number x total teams.",
    },
    {
      name: "totalTeams",
      value: settings.totalTeams,
      min: 2,
      max: 20,
      label: "Total teams",
      description: "How many teams participate in this auction. Setup and start checks use this value.",
    },
    {
      name: "rosterSize",
      value: settings.rosterSize,
      min: 8,
      max: 20,
      label: "Roster size",
      description: "How many players each team must finish with by the end of the auction.",
    },
    {
      name: "minBatsmen",
      value: settings.minBatsmen,
      min: 0,
      max: 12,
      label: "Min batsmen",
      description: "The minimum number of batsmen each final team roster must contain.",
    },
    {
      name: "maxBatsmen",
      value: settings.maxBatsmen,
      min: 0,
      max: 12,
      label: "Max batsmen",
      description: "The maximum number of batsmen a team can normally carry. One role may exceed its max by exactly one bench player.",
    },
    {
      name: "minBowlers",
      value: settings.minBowlers,
      min: 0,
      max: 12,
      label: "Min bowlers",
      description: "The minimum number of bowlers each final team roster must contain.",
    },
    {
      name: "maxBowlers",
      value: settings.maxBowlers,
      min: 0,
      max: 12,
      label: "Max bowlers",
      description: "The maximum number of bowlers a team can normally carry. One role may exceed its max by exactly one bench player.",
    },
    {
      name: "minAllRounders",
      value: settings.minAllRounders,
      min: 0,
      max: 12,
      label: "Min all-rounders",
      description: "The minimum number of all-rounders each final team roster must contain.",
    },
    {
      name: "maxAllRounders",
      value: settings.maxAllRounders,
      min: 0,
      max: 12,
      label: "Max all-rounders",
      description: "The maximum number of all-rounders a team can normally carry. One role may exceed its max by exactly one bench player.",
    },
    {
      name: "minWicketkeepers",
      value: settings.minWicketkeepers,
      min: 0,
      max: 12,
      label: "Min wicketkeepers",
      description: "The minimum number of wicketkeepers each final team roster must contain.",
    },
    {
      name: "maxWicketkeepers",
      value: settings.maxWicketkeepers,
      min: 0,
      max: 12,
      label: "Max wicketkeepers",
      description: "The maximum number of wicketkeepers a team can normally carry. One role may exceed its max by exactly one bench player.",
    },
  ] as const;

  return (
    <div className="grid gap-6">
      <Panel title="Auction setup checklist" eyebrow="Readiness">
        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className={`rounded-[1.5rem] border px-5 py-5 shadow-sm ${checklistTone}`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">
                  Launch status
                </div>
                <h3 className="mt-2 text-2xl font-bold tracking-tight text-ink">
                  {checklistHeadline}
                </h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  {checklistSummary}
                </p>
              </div>
              <div className="inline-flex w-fit items-center rounded-full bg-white/85 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-slate-700 shadow-sm">
                {setup.canStart ? "Ready" : `${checklistCompleteCount}/4 complete`}
              </div>
            </div>
            {!setup.auctionAlreadyStarted && setup.canStart ? (
              <div className="mt-4 rounded-2xl border border-white/70 bg-white/75 px-4 py-3 text-sm leading-6 text-slate-700">
                Starting the auction will first create the random owner nomination order and then open the live fantasy auction.
              </div>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
                Team slots
              </div>
              <div className="mt-2 text-3xl font-bold tracking-tight text-ink">
                {settings.totalTeams}
              </div>
              <div className="mt-1 text-sm text-slate-600">Configured for this auction</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
                Teams created
              </div>
              <div className="mt-2 text-3xl font-bold tracking-tight text-ink">
                {setup.configuredTeams}/{settings.totalTeams}
              </div>
              <div className="mt-1 text-sm text-slate-600">Participating team records</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
                Owners onboarded
              </div>
              <div className="mt-2 text-3xl font-bold tracking-tight text-ink">
                {setup.teamsWithOwners}/{settings.totalTeams}
              </div>
              <div className="mt-1 text-sm text-slate-600">Invite redemption completed</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
                Start state
              </div>
              <div className="mt-2 text-3xl font-bold tracking-tight text-ink">
                {setup.canStart ? "Ready" : "Blocked"}
              </div>
              <div className="mt-1 text-sm text-slate-600">Live start availability</div>
            </div>
          </div>
        </div>
        <div className="mt-5 grid gap-3 xl:grid-cols-2">
          {checklistItems.map((item, index) => (
            <div
              key={item.key}
              className={`rounded-[1.35rem] border px-4 py-4 shadow-sm ${
                item.done ? "border-turf/30 bg-turf/10" : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
                    Step {index + 1}
                  </div>
                  <div className="mt-1 text-base font-semibold text-ink">{item.title}</div>
                </div>
                <div
                  className={`inline-flex rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] ${
                    item.done ? "bg-turf text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {item.done ? "Done" : "Action needed"}
                </div>
              </div>
              <div className="mt-3 text-sm leading-6 text-slate-600">{item.description}</div>
            </div>
          ))}
        </div>
        {setup.extraTeamsIgnored > 0 ? (
          <div className="mt-4 rounded-2xl border border-amber/40 bg-amber/10 px-4 py-3 text-sm text-slate-700">
            This auction is currently using the top {settings.totalTeams} participating
            teams. {setup.extraTeamsIgnored} extra team record(s) exist in the system and
            are ignored for this auction setup.
          </div>
        ) : null}
        {setup.excessOwnedTeams > 0 ? (
          <div className="mt-4 rounded-2xl border border-rose/40 bg-rose/10 px-4 py-3 text-sm text-rose">
            There are more onboarded owners than the configured team count. Increase
            `Total teams` or reset the setup before starting the auction.
          </div>
        ) : null}
        {ignoredOwnedTeams.length > 0 ? (
          <div className="mt-4 rounded-2xl border border-rose/40 bg-white px-4 py-3 text-sm text-slate-700">
            <div className="font-semibold text-rose">Ignored onboarded teams</div>
            <div className="mt-1 text-slate-600">
              These teams currently have owners but are outside the configured participating
              set for this auction:
            </div>
            <div className="mt-2 text-xs text-slate-600">
              {ignoredOwnedTeams
                .map((team) => `${team.name} (${team.owner?.displayName ?? team.shortCode})`)
                .join(", ")}
            </div>
          </div>
        ) : null}
        <div className="mt-4">
          <form action={startAuctionAction}>
            <StartAuctionButton
              disabled={!setup.canStart}
              startedState={
                setup.auctionAlreadyStarted
                  ? auction.status === "PAUSED"
                    ? "paused"
                    : auction.status === "LIVE"
                      ? "live"
                      : "completed"
                  : null
              }
            />
          </form>
        </div>
      </Panel>

      <Panel title="Create auction season" eyebrow="Season setup">
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[1.5rem] border border-turf/20 bg-[linear-gradient(135deg,rgba(12,135,94,0.12),rgba(255,255,255,0.96))] px-5 py-4 text-sm text-slate-700">
            <div className="text-xs font-bold uppercase tracking-[0.22em] text-turf">
              Fresh season workflow
            </div>
            <div className="mt-2 leading-6">
              Create a new draft auction when you want a clean setup without losing previous rooms, picks, or audit history. New seasons begin in setup mode and can be configured here before they ever go live.
            </div>
          </div>
          <form action={createAuctionSeasonAction} className="grid gap-3 rounded-[1.5rem] border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              <span>Auction name</span>
              <input
                className="rounded-2xl border border-slate-200 px-4 py-3"
                defaultValue={`Auction ${new Date().getFullYear() + 1}`}
                name="name"
                placeholder="Auction name"
                required
              />
            </label>
            <p className="text-sm leading-6 text-slate-500">
              The new season copies the current timer and roster settings plus the existing player pool, then stays in draft/setup mode until you finish onboarding teams and owners.
            </p>
            <button
              className="rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white"
              type="submit"
            >
              Create draft auction
            </button>
          </form>
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Panel title="Configure auction" eyebrow="Rules">
          <p className="mb-4 text-sm text-slate-500">
            Hover the info icon for a quick explanation of each rule. The same rules are
            enforced by the server during bidding and drafting.
          </p>
          <form action={updateSettingsAction} className="grid gap-4 md:grid-cols-2">
            {settingsFields.map((field) => (
              <label key={field.name} className="grid gap-2 text-sm font-medium text-slate-700">
                <span className="flex items-center gap-2">
                  <span>{field.label}</span>
                  <span
                    aria-label={`${field.label}: ${field.description}`}
                    className="inline-flex text-slate-400"
                    title={field.description}
                  >
                    <Info className="h-4 w-4" />
                  </span>
                </span>
                <input
                  className="rounded-2xl border border-slate-200 px-4 py-3"
                  defaultValue={field.value}
                  max={field.max}
                  min={field.min}
                  name={field.name}
                  required
                  step={1}
                  type="number"
                />
                <span className="text-xs font-normal text-slate-500">{field.description}</span>
              </label>
            ))}
            <button
              className="rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white md:col-span-2"
              type="submit"
            >
              Save auction settings
            </button>
          </form>
        </Panel>

        <Panel title="Create team" eyebrow="Teams">
          <form action={createTeamAction} className="grid gap-4">
            <input
              className="rounded-2xl border border-slate-200 px-4 py-3"
              name="name"
              placeholder="Team name"
              required
            />
            <input
              className="rounded-2xl border border-slate-200 px-4 py-3 uppercase"
              name="shortCode"
              placeholder="Short code"
              required
            />
            <button
              className="rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white"
              type="submit"
            >
              Add team
            </button>
            <p className="text-sm text-slate-500">
              {setup.missingTeamSlots === 0
                ? "All configured teams have been created."
                : `${setup.missingTeamSlots} team slot(s) still need to be created.`}
            </p>
          </form>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Panel title="Participation scope" eyebrow="Teams">
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <div className="mb-2 text-sm font-semibold text-ink">Participating teams</div>
              <div className="grid gap-2">
                {teams.map((team) => (
                  <div
                    key={team.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                  >
                    <div className="font-semibold">
                      {team.name} ({team.shortCode})
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {team.owner ? `Owner: ${team.owner.displayName}` : "Awaiting owner onboarding"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 text-sm font-semibold text-ink">Ignored teams</div>
              <div className="grid gap-2">
                {ignoredTeams.length > 0 ? (
                  ignoredTeams.map((team) => (
                    <div
                      key={team.id}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                    >
                      <div className="font-semibold">
                        {team.name} ({team.shortCode})
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {team.owner
                          ? `Ignored because total teams is ${settings.totalTeams}. Owner: ${team.owner.displayName}`
                          : "Ignored because it falls outside the current participating team count."}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                    No teams are currently being ignored.
                  </div>
                )}
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="Generate invite" eyebrow="Onboarding">
          <InviteGeneratorForm
            submitLabel="Generate invite URL"
            teams={inviteEligibleTeams.map((team) => ({
              id: team.id,
              name: team.name,
            }))}
          />
          <p className="text-sm text-slate-500">
              Invite URLs are team-bound and expire automatically. Reissuing an invite
              revokes the previous pending one for that team.
          </p>
        </Panel>

        <Panel title="Team onboarding status" eyebrow="Progress">
          <div className="grid gap-3">
            {teams.map((team) => {
              const invite = team.invites[0];

              return (
                <div
                  key={team.id}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold">
                      {team.name} ({team.shortCode})
                    </span>
                    <span>{team.owner ? "OWNER READY" : invite?.status ?? "NO INVITE"}</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {team.owner
                      ? `Owner assigned: ${team.owner.displayName}`
                      : invite
                        ? `Latest invite expires ${invite.expiresAt.toLocaleString()}`
                        : "Create the team first, then issue an invite."}
                  </div>
                  {invite && !team.owner ? (
                    <div className="mt-2 break-all text-xs text-turf">
                      {env.APP_URL}/invite/{invite.publicToken}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          {allTeams.length > teams.length ? (
            <div className="mt-4 text-xs text-slate-500">
              Showing the {teams.length} team(s) currently selected for this auction.
            </div>
          ) : null}
        </Panel>
      </div>
    </div>
  );
}
