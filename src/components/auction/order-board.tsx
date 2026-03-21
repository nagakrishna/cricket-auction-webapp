import type { AuctionSnapshot } from "@/lib/realtime/events";

type OrderBoardProps = {
  title: string;
  subtitle: string;
  order: AuctionSnapshot["biddingNominationOrder"] | NonNullable<AuctionSnapshot["snakeOrderPreview"]>;
  highlightedTeamId?: string | null;
  ownerTeamId?: string | null;
};

export function OrderBoard({
  title,
  subtitle,
  order,
  highlightedTeamId,
  ownerTeamId,
}: OrderBoardProps) {
  return (
    <section className="rounded-[1.75rem] border border-white/60 bg-white/85 p-5 shadow-panel backdrop-blur">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
        {title}
      </p>
      <h3 className="mt-2 text-2xl font-semibold text-ink">{subtitle}</h3>
      <div className="mt-4 grid gap-2">
        {order.map((entry) => (
          <div
            key={entry.teamId}
            className={`rounded-2xl border px-4 py-3 text-sm ${
              highlightedTeamId === entry.teamId
                ? "border-turf/40 bg-turf/12 text-ink ring-2 ring-turf/20"
                : ownerTeamId === entry.teamId
                  ? "border-amber/40 bg-amber/10 text-ink"
                  : "border-slate-200 bg-slate-50 text-slate-700"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold">{entry.teamName}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {highlightedTeamId === entry.teamId ? (
                    <span className="rounded-full bg-turf px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white">
                      On the clock
                    </span>
                  ) : null}
                  {ownerTeamId === entry.teamId ? (
                    <span className="rounded-full bg-amber px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white">
                      Your team
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="rounded-full bg-white/80 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-600">
                #{entry.position}
              </div>
            </div>
            <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
              {entry.shortCode}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
