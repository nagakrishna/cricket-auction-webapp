"use client";

import { useEffect, useRef } from "react";

import type { AuctionSnapshot } from "@/lib/realtime/events";

type PlayerPoolProps = {
  players: AuctionSnapshot["availablePlayers"];
  actionMode: "nominate" | "pick";
  canAct: boolean;
  onAct: (playerId: string) => void;
  search: string;
  onSearch: (value: string) => void;
  roleFilter: string;
  onRoleFilter: (value: string) => void;
  teamFilter: string;
  onTeamFilter: (value: string) => void;
  teamOptions: string[];
  currentTurnLabel: string;
  currentTurnState: "active" | "waiting" | "idle";
};

export function PlayerPool({
  players,
  actionMode,
  canAct,
  onAct,
  search,
  onSearch,
  roleFilter,
  onRoleFilter,
  teamFilter,
  onTeamFilter,
  teamOptions,
  currentTurnLabel,
  currentTurnState,
}: PlayerPoolProps) {
  const selectionBannerRef = useRef<HTMLDivElement | null>(null);
  const previousTurnStateRef = useRef(currentTurnState);

  useEffect(() => {
    const previousState = previousTurnStateRef.current;
    previousTurnStateRef.current = currentTurnState;

    if (currentTurnState === "active" && previousState !== "active") {
      selectionBannerRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [currentTurnState]);

  return (
    <section
      className={`rounded-[1.75rem] border bg-white/85 p-5 shadow-panel backdrop-blur transition-all ${
        currentTurnState === "active"
          ? "border-turf/40 ring-4 ring-turf/10"
          : "border-white/60"
      }`}
    >
      <div className="grid gap-4">
        <div className="max-w-2xl space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
            Player board
          </p>
          <h2 className="text-2xl font-semibold text-ink">
            {actionMode === "nominate" ? "Search and nominate players" : "Search the player pool"}
          </h2>
          <p className="text-sm leading-6 text-slate-600">
            {actionMode === "nominate"
              ? "Track nominations, search the available pool, and be ready when your team is on the clock."
              : "Browse available players, filter by role or IPL team, and prepare for the next valid pick."}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <input
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm"
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Search players"
            value={search}
          />
          <select
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm"
            onChange={(event) => onRoleFilter(event.target.value)}
            value={roleFilter}
          >
            <option value="ALL">All roles</option>
            <option value="BATSMAN">Batsman</option>
            <option value="BOWLER">Bowler</option>
            <option value="ALL_ROUNDER">All-rounder</option>
            <option value="WICKETKEEPER">Wicketkeeper</option>
          </select>
          <select
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm"
            onChange={(event) => onTeamFilter(event.target.value)}
            value={teamFilter}
          >
            <option value="ALL">All IPL teams</option>
            {teamOptions.map((team) => (
              <option key={team} value={team}>
                {team}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div
        ref={selectionBannerRef}
        className={`mt-4 rounded-[1.5rem] border px-5 py-4 ${
          currentTurnState === "active"
            ? "border-turf/30 bg-[linear-gradient(135deg,rgba(12,135,94,0.22),rgba(255,255,255,0.96))] shadow-lg ring-4 ring-turf/10"
            : currentTurnState === "waiting"
              ? "border-amber/30 bg-[linear-gradient(135deg,rgba(245,158,11,0.16),rgba(255,255,255,0.96))]"
              : "border-slate-200 bg-slate-50"
        }`}
      >
        <p
          className={`text-xs font-bold uppercase tracking-[0.24em] ${
            currentTurnState === "active"
              ? "text-turf"
              : currentTurnState === "waiting"
                ? "text-amber-700"
                : "text-slate-500"
          }`}
        >
          {currentTurnState === "active"
            ? "Select Player Now"
            : currentTurnState === "waiting"
              ? "Waiting For Selection"
              : "Selection Status"}
        </p>
        <div
          className={`mt-2 text-2xl font-bold tracking-tight ${
            currentTurnState === "active"
              ? "text-ink"
              : currentTurnState === "waiting"
                ? "text-amber-950"
                : "text-slate-700"
          }`}
        >
          {currentTurnLabel}
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {players.slice(0, 36).map((player) => (
          <div key={player.playerId} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
            <div className="flex items-center justify-between gap-3">
              <div>
              <div className="font-semibold">{player.name}</div>
                <div className="text-xs text-slate-500">
                  {player.role} • {player.iplTeam}
                </div>
              </div>
              <div className="text-right text-xs text-slate-500">
                Rank #{player.rankingScore}
              </div>
            </div>
            <button
              className="mt-3 rounded-xl bg-turf px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={!canAct || !player.isValidForCurrentTurn}
              onClick={() => onAct(player.playerId)}
              type="button"
            >
              {canAct
                ? player.isValidForCurrentTurn
                  ? actionMode === "nominate"
                    ? "Nominate player"
                    : "Pick player"
                  : actionMode === "nominate"
                    ? "Unavailable for nomination"
                    : "Unavailable for this pick"
                : "Waiting"}
            </button>
            {!player.isValidForCurrentTurn ? (
              <p className="mt-2 text-xs text-rose">
                {player.invalidReason ?? "This player does not fit the current roster rules."}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
