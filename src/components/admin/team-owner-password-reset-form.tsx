"use client";

import { useActionState } from "react";

import {
  resetTeamOwnerPasswordFormAction,
  type ResetTeamOwnerPasswordFormState,
} from "@/app/admin/_actions/actions";

type TeamOwnerPasswordResetFormProps = {
  teamId: string;
  teamName: string;
  ownerName: string;
};

const initialState: ResetTeamOwnerPasswordFormState = {
  ok: false,
};

export function TeamOwnerPasswordResetForm({
  teamId,
  teamName,
  ownerName,
}: TeamOwnerPasswordResetFormProps) {
  const [state, formAction, pending] = useActionState(
    resetTeamOwnerPasswordFormAction,
    initialState,
  );

  return (
    <form
      action={formAction}
      className="grid gap-3 rounded-2xl border border-turf/15 bg-[linear-gradient(135deg,rgba(12,135,94,0.08),rgba(255,255,255,0.92))] p-3 lg:grid-cols-[minmax(0,1fr)_auto]"
    >
      <input name="teamId" type="hidden" value={teamId} />
      <label className="grid gap-2 text-sm font-medium text-slate-700">
        Reset owner password for {ownerName}
        <input
          className="rounded-2xl border border-slate-200 px-4 py-3 text-sm"
          minLength={8}
          name="password"
          placeholder="New temporary password"
          required
          type="password"
        />
      </label>
      <button
        className="self-end rounded-2xl border border-turf/25 bg-white px-4 py-3 text-sm font-semibold text-turf shadow-sm transition hover:border-turf/35 hover:bg-turf/5 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Resetting..." : "Reset password"}
      </button>
      {state.ok ? (
        <div className="lg:col-span-2 rounded-2xl border border-turf/30 bg-white/72 px-4 py-3 text-sm text-slate-700 shadow-sm">
          Password reset for {state.ownerName ?? ownerName} on {state.teamName ?? teamName}. Active sessions were signed out.
        </div>
      ) : null}
      {!state.ok && state.error ? (
        <div className="lg:col-span-2 rounded-2xl border border-rose/30 bg-rose/10 px-4 py-3 text-sm text-rose">
          {state.error}
        </div>
      ) : null}
    </form>
  );
}
