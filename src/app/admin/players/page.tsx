import { createPlayerAction, importCsvAction } from "@/app/admin/_actions/actions";
import { Panel } from "@/components/ui/panel";
import { listPlayers } from "@/server/players/player-service";

const roles = ["BATSMAN", "BOWLER", "ALL_ROUNDER", "WICKETKEEPER"] as const;

export default async function PlayersPage() {
  const players = await listPlayers();
  const assignedPlayers = players.filter((player: (typeof players)[number]) => player.assignmentStatus === "ASSIGNED").length;
  const availablePlayers = players.length - assignedPlayers;

  return (
    <div className="grid gap-6">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-[1.5rem] border border-white/60 bg-white/85 px-5 py-4 text-sm text-slate-700 shadow-panel backdrop-blur">
          <div className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Player pool</div>
          <div className="mt-2 text-3xl font-bold tracking-tight text-ink">{players.length}</div>
        </div>
        <div className="rounded-[1.5rem] border border-turf/20 bg-[linear-gradient(135deg,rgba(12,135,94,0.12),rgba(255,255,255,0.96))] px-5 py-4 text-sm text-slate-700 shadow-panel backdrop-blur">
          <div className="text-xs font-bold uppercase tracking-[0.22em] text-turf">Available</div>
          <div className="mt-2 text-3xl font-bold tracking-tight text-ink">{availablePlayers}</div>
        </div>
        <div className="rounded-[1.5rem] border border-amber/20 bg-[linear-gradient(135deg,rgba(245,158,11,0.12),rgba(255,255,255,0.96))] px-5 py-4 text-sm text-slate-700 shadow-panel backdrop-blur">
          <div className="text-xs font-bold uppercase tracking-[0.22em] text-amber-700">Assigned</div>
          <div className="mt-2 text-3xl font-bold tracking-tight text-ink">{assignedPlayers}</div>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Add player" eyebrow="Players">
          <form action={createPlayerAction} className="grid gap-4">
            <input className="rounded-2xl border border-slate-200 px-4 py-3" name="name" placeholder="Player name" required />
            <select className="rounded-2xl border border-slate-200 px-4 py-3" name="role" defaultValue="BATSMAN">
              {roles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
            <input className="rounded-2xl border border-slate-200 px-4 py-3" name="iplTeam" placeholder="IPL team" required />
            <input className="rounded-2xl border border-slate-200 px-4 py-3" name="rankingScore" placeholder="Ranking score" required type="number" />
            <button className="rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white" type="submit">
              Save player
            </button>
          </form>
        </Panel>
        <Panel title="Upload ranking CSV" eyebrow="Import">
          <form action={importCsvAction} className="grid gap-4">
            <input accept=".csv,text/csv" className="rounded-2xl border border-slate-200 px-4 py-3" name="file" required type="file" />
            <p className="text-sm text-slate-500">Expected headers: <code>name</code>, <code>role</code>, <code>iplTeam</code>, <code>rankingScore</code>.</p>
            <button className="rounded-2xl bg-turf px-4 py-3 text-sm font-semibold text-white" type="submit">
              Import rankings
            </button>
          </form>
        </Panel>
      </div>
      <Panel title="Player pool" eyebrow="Ranking">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {players.map((player: (typeof players)[number]) => (
            <div
              key={player.id}
              className={`rounded-2xl border px-4 py-3 text-sm ${
                player.assignmentStatus === "ASSIGNED"
                  ? "border-amber/30 bg-amber/10 text-slate-800"
                  : "border-slate-200 bg-white text-slate-700"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">{player.name}</span>
                <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-bold text-slate-700 shadow-sm">
                  #{player.rankingScore}
                </span>
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {player.role} • {player.iplTeam} • {player.assignmentStatus}
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
