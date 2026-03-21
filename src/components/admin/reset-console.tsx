"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  resetAdminDataAction,
  type ResetAdminDataFormState,
} from "@/app/admin/_actions/actions";
import type { AdminResetPreset } from "@/lib/validation/admin";

type ResetPresetCard = {
  preset: AdminResetPreset;
  label: string;
  summary: string;
  deletes: string;
  keeps: string;
};

const RESET_PRESETS: ResetPresetCard[] = [
  {
    preset: "CURRENT_AUCTION",
    label: "Reset current auction",
    summary: "Delete only the latest auction and replace it with a fresh ready-to-configure auction.",
    deletes: "Latest auction record, rounds, bids, rosters, assignments, auction-scoped logs, live connections.",
    keeps: "Teams, players, owner accounts, invites, completed auction history.",
  },
  {
    preset: "LIVE_PROGRESS",
    label: "Reset live auction progress",
    summary: "Keep the current auction shell and settings, but wipe its live activity and assignments.",
    deletes: "Rounds, bids, roster entries, auction-player assignments, auction logs, live connections.",
    keeps: "Current auction record, settings, teams, players, owners, invites.",
  },
  {
    preset: "PLAYERS_ONLY_RESEED",
    label: "Refresh players from CSV",
    summary: "Replace the player pool and rebuild a fresh auction without deleting teams, owner accounts, or invites.",
    deletes: "Players, auctions, rounds, bids, roster entries, assignments, auction logs, live connections.",
    keeps: "Teams, owner accounts, invite links, active sessions.",
  },
  {
    preset: "FULL_RESEED",
    label: "Full reseed",
    summary: "Wipe all application data and restore the default seeded baseline.",
    deletes: "All auctions, teams, players, owners, invites, sessions, logs, live state.",
    keeps: "Nothing except the newly seeded baseline that is recreated immediately.",
  },
];

const initialState: ResetAdminDataFormState = {
  ok: false,
};

export function ResetConsole() {
  const [selectedPreset, setSelectedPreset] = useState<ResetPresetCard | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [state, formAction, pending] = useActionState(
    resetAdminDataAction,
    initialState,
  );
  const router = useRouter();

  useEffect(() => {
    if (state.ok && state.redirectTo) {
      router.replace(state.redirectTo as "/login");
    }
  }, [router, state.ok, state.redirectTo]);

  useEffect(() => {
    if (state.ok) {
      setConfirmation("");
      setSelectedPreset(null);
    }
  }, [state.ok]);

  const submitDisabled = useMemo(
    () => confirmation.trim() !== "RESET" || pending,
    [confirmation, pending],
  );

  return (
    <div className="grid gap-4">
      {state.ok && state.message ? (
        <div className="rounded-[1.5rem] border border-turf/25 bg-[linear-gradient(135deg,rgba(12,135,94,0.10),rgba(255,255,255,0.96))] px-5 py-4 text-sm text-slate-700 shadow-sm">
          {state.message}
        </div>
      ) : null}
      {!state.ok && state.error ? (
        <div className="rounded-[1.5rem] border border-rose/30 bg-rose/10 px-5 py-4 text-sm text-rose">
          {state.error}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-3">
        {RESET_PRESETS.map((preset) => (
          <div
            key={preset.preset}
            className="rounded-[1.5rem] border border-rose/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,245,245,0.92))] p-4 shadow-sm"
          >
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-rose-700">
              Danger preset
            </p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-ink">
              {preset.label}
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{preset.summary}</p>
            <div className="mt-4 rounded-2xl border border-white/70 bg-white/72 px-4 py-3 text-sm text-slate-700">
              <div>
                <span className="font-semibold text-rose-700">Deletes:</span> {preset.deletes}
              </div>
              <div className="mt-2">
                <span className="font-semibold text-turf">Keeps:</span> {preset.keeps}
              </div>
            </div>
            <button
              className="mt-4 rounded-2xl border border-rose/30 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(255,241,242,0.96))] px-4 py-3 text-sm font-semibold text-rose-800 shadow-sm transition hover:border-rose/40 hover:bg-white"
              onClick={() => {
                setConfirmation("");
                setSelectedPreset(preset);
              }}
              type="button"
            >
              Open confirm dialog
            </button>
          </div>
        ))}
      </div>

      {selectedPreset ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/45 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[2rem] border border-white/70 bg-white/96 p-6 shadow-[0_28px_80px_rgba(8,20,32,0.28)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.26em] text-rose-700">
                  Confirm destructive action
                </p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-ink">
                  {selectedPreset.label}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  This action is destructive and should only be used when you are certain you want to wipe the selected data scope.
                </p>
              </div>
              <button
                className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
                onClick={() => setSelectedPreset(null)}
                type="button"
              >
                Close
              </button>
            </div>

            <div className="mt-5 rounded-[1.5rem] border border-rose/20 bg-rose/5 px-5 py-4 text-sm text-slate-700">
              <div className="font-semibold text-rose-800">You are about to run:</div>
              <div className="mt-2">{selectedPreset.summary}</div>
            </div>

            <form action={formAction} className="mt-5 grid gap-4">
              <input name="preset" type="hidden" value={selectedPreset.preset} />
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Type <span className="font-bold text-rose-700">RESET</span> to continue
                <input
                  autoFocus
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                  name="confirmation"
                  onChange={(event) => setConfirmation(event.target.value)}
                  placeholder="RESET"
                  required
                  value={confirmation}
                />
              </label>

              <div className="flex flex-wrap items-center justify-end gap-3">
                <button
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                  onClick={() => setSelectedPreset(null)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="rounded-2xl bg-[linear-gradient(135deg,#7f1d1d,#be123c)] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_32px_rgba(190,24,93,0.24)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
                  disabled={submitDisabled}
                  type="submit"
                >
                  {pending ? "Resetting..." : `Confirm ${selectedPreset.label}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
