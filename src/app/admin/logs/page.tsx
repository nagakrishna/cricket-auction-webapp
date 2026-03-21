import { prisma } from "@/lib/db/prisma";
import { Panel } from "@/components/ui/panel";

export default async function LogsPage() {
  const [logs, teams] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
    }),
    prisma.team.findMany({
      select: {
        id: true,
        name: true,
      },
    }),
  ]);

  const teamNameById = new Map(teams.map((team) => [team.id, team.name]));

  function replaceTeamIdsWithNames(text: string) {
    let result = text;

    for (const [teamId, teamName] of teamNameById) {
      result = result.replaceAll(teamId, teamName);
    }

    return result;
  }

  function formatMetadata(metadata: unknown) {
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
      return [];
    }

    return Object.entries(metadata as Record<string, unknown>).map(([key, value]) => {
      const normalizedValue =
        typeof value === "string" && teamNameById.has(value)
          ? teamNameById.get(value)
          : value;

      return {
        key,
        value:
          typeof normalizedValue === "string"
            ? replaceTeamIdsWithNames(normalizedValue)
            : String(normalizedValue),
      };
    });
  }

  return (
    <Panel title="Audit log" eyebrow="Logs">
      <div className="mb-4 rounded-[1.5rem] border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-600">
        The latest room activity, interventions, accepted and rejected actions, and invite lifecycle events all land here for review.
      </div>
      <div className="grid gap-3">
        {logs.map((log: (typeof logs)[number]) => (
          <div key={log.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
            <div className="flex items-center justify-between gap-3">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-700">
                {log.action}
              </span>
              <span className="text-xs text-slate-500">{log.createdAt.toLocaleString()}</span>
            </div>
            <div className="mt-1 text-sm text-slate-600">
              {replaceTeamIdsWithNames(log.message)}
            </div>
            {formatMetadata(log.metadata).length > 0 ? (
              <div className="mt-3 grid gap-2 rounded-2xl bg-slate-50 px-3 py-3 text-xs text-slate-500">
                {formatMetadata(log.metadata).map((item) => (
                  <div key={`${log.id}-${item.key}`} className="flex items-start justify-between gap-3">
                    <span className="font-semibold uppercase tracking-[0.16em] text-slate-400">
                      {item.key}
                    </span>
                    <span className="text-right text-slate-600">{item.value}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </Panel>
  );
}
