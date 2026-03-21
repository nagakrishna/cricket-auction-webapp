"use client";

import { useEffect, useState } from "react";

import type { AuctionActivityItem } from "@/lib/realtime/events";

export function ActivityFeed({
  items,
  title = "Activity feed",
  showHeader = true,
}: {
  items: AuctionActivityItem[];
  title?: string;
  showHeader?: boolean;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <section className="rounded-[1.75rem] border border-white/60 bg-white/85 p-5 shadow-panel backdrop-blur">
      {showHeader ? (
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
          {title}
        </p>
      ) : null}
      <div className="mt-4 grid gap-2">
        {items.length > 0 ? (
          items.map((item) => (
            <div key={item.id} className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="font-medium leading-6">{item.message}</div>
                <div className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {mounted ? new Date(item.createdAt).toLocaleTimeString() : "--:--"}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
            No live activity yet.
          </div>
        )}
      </div>
    </section>
  );
}
