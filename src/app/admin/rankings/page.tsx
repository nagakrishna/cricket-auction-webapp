import { importCsvAction } from "@/app/admin/_actions/actions";
import { Panel } from "@/components/ui/panel";

export default function RankingsPage() {
  return (
    <Panel
      title="Ranking CSV upload"
      eyebrow="Import"
    >
      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <form action={importCsvAction} className="grid gap-4">
          <div className="rounded-[1.5rem] border border-turf/20 bg-[linear-gradient(135deg,rgba(12,135,94,0.12),rgba(255,255,255,0.96))] px-5 py-4 text-sm text-slate-700">
            <div className="text-xs font-bold uppercase tracking-[0.22em] text-turf">
              Ranking import
            </div>
            <div className="mt-2 leading-6">
              Upload a fresh CSV whenever you want to tune auto-pick behavior and the spend-based snake board.
            </div>
          </div>
          <input
            accept=".csv,text/csv"
            className="rounded-2xl border border-slate-200 px-4 py-3"
            name="file"
            required
            type="file"
          />
          <button
            className="rounded-2xl bg-turf px-4 py-3 text-sm font-semibold text-white"
            type="submit"
          >
            Upload rankings
          </button>
        </form>
        <div className="rounded-[1.5rem] bg-slate-50 px-5 py-4 text-sm text-slate-600">
          <p className="font-semibold text-slate-800">Expected CSV columns</p>
          <p className="mt-2">
            Use <code>name</code>, <code>role</code>, <code>iplTeam</code>,
            and <code>rankingScore</code>. Existing players are matched by name
            + IPL team and updated in place.
          </p>
          <div className="mt-4 rounded-2xl bg-white px-4 py-3 text-xs text-slate-500">
            Tip: lower ranking numbers are favored by snake auto-pick when a team times out and multiple roster-valid players are available.
          </div>
        </div>
      </div>
    </Panel>
  );
}
