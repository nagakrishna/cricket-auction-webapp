import { getAuctionSnapshot } from "@/server/auction/auction-service";
import {
  getAuctionAdminData,
  getAuctionSetupStatus,
} from "@/server/admin/settings-service";
import { Panel } from "@/components/ui/panel";
import { ResetConsole } from "@/components/admin/reset-console";
import { listPlayers } from "@/server/players/player-service";
import { listParticipatingTeams } from "@/server/teams/team-service";
import Link from "next/link";

export default async function AdminLandingPage() {
  const auction = await getAuctionAdminData();
  const settings = auction.settings;
  const setup = await getAuctionSetupStatus();
  const snapshot = await getAuctionSnapshot();
  const teams = await listParticipatingTeams();
  const players = await listPlayers();
  const teamsWithoutOwners = teams.filter((team) => !team.ownerId).length;
  const assignedPlayers = players.filter((player) => player.assignmentStatus === "ASSIGNED").length;

  return (
    <div className="grid gap-6">
      <Panel title="Overview dashboard" eyebrow="Admin">
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[1.5rem] border border-slate-200 bg-white px-5 py-4 text-sm text-slate-700 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
              What this page is for
            </div>
            <div className="mt-2 leading-6">
              Use Overview to monitor auction health, setup readiness, roster progress, and live standings at a glance. For pause, resume, reopen, or timed-out round actions, use the Live Auction control room.
            </div>
          </div>
          <div className="flex items-center justify-start lg:justify-end">
            <Link
              className="inline-flex min-h-[64px] items-center justify-center rounded-2xl bg-ink px-6 py-4 text-base font-semibold text-white shadow-sm transition hover:translate-y-[-1px] hover:bg-ink/95"
              href="/admin/auction"
            >
              Open Live Auction
            </Link>
          </div>
        </div>
      </Panel>
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Panel title="Auction status" eyebrow="Overview">
          <div className="mb-4 flex flex-col gap-3 rounded-[1.5rem] border border-slate-200/80 bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Current auction
              </p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink">
                {auction.name}
              </h2>
            </div>
            <div className="inline-flex w-fit items-center rounded-full bg-ink px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-white shadow-sm">
              {auction.status}
            </div>
          </div>
          <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl bg-turf/10 px-4 py-3 text-sm text-slate-700">
              Teams configured: {teams.length}/{settings.totalTeams}
            </div>
            <div className="rounded-2xl bg-amber/10 px-4 py-3 text-sm text-slate-700">
              Teams missing owners: {teamsWithoutOwners}
            </div>
            <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
              Players loaded: {players.length}
            </div>
            <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
              Players assigned: {assignedPlayers}
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
              Status: {auction.status}
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
              Phase: {auction.phase}
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
              Current round: {auction.activeRoundNumber}
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
              Turn type: {auction.turnType}
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            {setup.auctionAlreadyStarted
              ? auction.status === "PAUSED"
                ? "This auction is already started and currently paused. Resume it from the live controls instead of starting again."
                : auction.status === "LIVE"
                  ? "Random owner nomination order is ready and the auction is now live. Use the live controls to manage the room."
                  : "This auction has already been completed. Create a new auction season to run another room."
              : setup.canStart
                ? "Auction setup is complete. Starting the auction will generate the random nomination order for team owners."
              : setup.excessOwnedTeams > 0
                ? `Setup mismatch: ${setup.excessOwnedTeams} extra onboarded team(s) exceed the configured total.`
                : `Setup incomplete: ${setup.missingTeamSlots} team slot(s) still need configuration and ${setup.teamsMissingOwners} configured team(s) still need owners.`}
          </div>
          {!setup.auctionAlreadyStarted && setup.canStart ? (
            <div className="mt-4 rounded-2xl border border-turf/30 bg-turf/10 px-4 py-3 text-sm text-slate-700">
              Starting the auction will first create the random owner nomination order and then open the live room for bidding.
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="text-sm text-slate-500">
              Use the Setup tab for auction configuration, team onboarding, and creating the next auction season.
            </span>
          </div>
        </Panel>
        <Panel title="Live leaderboard" eyebrow="Realtime">
          <div className="grid gap-3">
            {snapshot.leaderboard.map((team) => (
              <div key={team.teamId} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{team.teamName}</span>
                  <span>{team.spend}</span>
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {team.players} players • {team.biddingWins} bidding wins
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <Panel
        title="Reset & data wipe console"
        eyebrow="Danger zone"
        className="border-rose/25 bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.08),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,246,246,0.96))]"
      >
        <div className="mb-4 rounded-[1.5rem] border border-rose/20 bg-rose/5 px-5 py-4 text-sm leading-6 text-slate-700">
          Use these tools only when you intentionally want to wipe auction data. Every action below requires a typed confirmation before it can run.
        </div>
        <ResetConsole />
      </Panel>
    </div>
  );
}
