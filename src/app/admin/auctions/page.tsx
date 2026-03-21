import Link from "next/link";

import { Panel } from "@/components/ui/panel";
import { listAuctions } from "@/server/admin/auction-catalog-service";

export default async function AuctionsPage() {
  const auctions = await listAuctions();

  return (
    <div className="grid gap-6">
      <Panel title="Auction history" eyebrow="Seasons">
        <div className="mb-4 rounded-[1.5rem] border border-slate-200 bg-white px-5 py-4 text-sm leading-6 text-slate-700 shadow-sm">
          History is read-only. Use the Setup tab when you want to create and configure a fresh auction season without losing earlier rooms, picks, and audit history.
        </div>
        <div className="grid gap-3">
          {auctions.map((auction: (typeof auctions)[number]) => (
            <Link
              key={auction.id}
              href={`/admin/auctions/${auction.id}`}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">{auction.name}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-700">
                  {auction.status}
                </span>
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Created {auction.createdAt.toLocaleString()} • {auction._count.rosterEntries} picks
                • {auction._count.rounds} rounds • {auction._count.bids} bids
              </div>
            </Link>
          ))}
        </div>
      </Panel>
    </div>
  );
}
