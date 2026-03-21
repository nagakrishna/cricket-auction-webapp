import Link from "next/link";

import { Panel } from "@/components/ui/panel";
import { Shell } from "@/components/layout/shell";

const highlights = [
  "Randomized nomination order, live bidding, and spend-based snake draft flow",
  "Invite-only team owner onboarding with reconnect-safe realtime state",
  "Strict roster enforcement, automatic bid validation, and audit-ready logs",
];

const quickLinks = [
  {
    href: "/login",
    title: "Admin sign in",
    description: "Set up teams, configure rules, manage invites, and run the room live.",
    tone: "bg-ink text-white",
  },
  {
    href: "/admin/setup",
    title: "Auction setup",
    description: "Review roster rules, team count, onboarding readiness, and start controls.",
    tone: "bg-turf/10 text-slate-800",
  },
  {
    href: "/leaderboard",
    title: "Live board",
    description: "See current standings, team picks, and the active turn as the auction unfolds.",
    tone: "bg-amber/10 text-slate-800",
  },
] as const;

export default function HomePage() {
  return (
    <Shell
      title="Run a live cricket auction with confidence"
      description="A real-time control room for admins and team owners to manage nominations, bidding, snake draft turns, roster rules, and every decision on a single shared state."
    >
      <div className="grid gap-6">
        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <Panel title="What this platform handles" eyebrow="Live auction">
            <div className="grid gap-3">
              {highlights.map((highlight) => (
                <div
                  key={highlight}
                  className="rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-4 text-sm leading-6 text-slate-700"
                >
                  {highlight}
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-[1.5rem] border border-turf/20 bg-[linear-gradient(135deg,rgba(12,135,94,0.14),rgba(255,255,255,0.96))] px-5 py-4">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-turf">
                Match-day feel
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                Owners see who is nominating, who is leading the bid, whose turn is next,
                and how every pick changes the room in real time.
              </p>
            </div>
          </Panel>

          <Panel title="Start here" eyebrow="Navigation">
            <div className="grid gap-3">
              {quickLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-[1.5rem] px-5 py-4 transition hover:translate-y-[-1px] ${link.tone}`}
                >
                  <div className="text-sm font-bold uppercase tracking-[0.2em]">
                    {link.title}
                  </div>
                  <div className="mt-2 text-sm leading-6 opacity-90">
                    {link.description}
                  </div>
                </Link>
              ))}
            </div>
          </Panel>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <Panel title="Admins" eyebrow="Control room">
            <p className="text-sm leading-6 text-slate-700">
              Configure rules, manage teams and invites, monitor the live room, and
              resolve timeouts without losing the authoritative auction state.
            </p>
          </Panel>
          <Panel title="Team owners" eyebrow="Live room">
            <p className="text-sm leading-6 text-slate-700">
              Nominate players, place bids, follow the nomination order, and track every
              team’s picks from one synchronized auction view.
            </p>
          </Panel>
          <Panel title="Transparency" eyebrow="Shared state">
            <p className="text-sm leading-6 text-slate-700">
              Countdown timers, nomination order, current leaders, team picks, and logs
              all come from the server so every participant sees the same truth.
            </p>
          </Panel>
        </section>
      </div>
    </Shell>
  );
}
