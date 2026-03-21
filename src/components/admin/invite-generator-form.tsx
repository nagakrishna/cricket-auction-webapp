"use client";

import { useActionState } from "react";

import {
  createInviteFormAction,
  type CreateInviteFormState,
} from "@/app/admin/_actions/actions";

type InviteGeneratorFormProps = {
  teams: Array<{
    id: string;
    name: string;
  }>;
  submitLabel: string;
};

const initialState: CreateInviteFormState = {
  ok: false,
};

export function InviteGeneratorForm({
  teams,
  submitLabel,
}: InviteGeneratorFormProps) {
  const [state, formAction, pending] = useActionState(
    createInviteFormAction,
    initialState,
  );

  return (
    <form action={formAction} className="grid gap-4">
      <select
        className="rounded-2xl border border-slate-200 px-4 py-3"
        disabled={teams.length === 0 || pending}
        name="teamId"
        required
      >
        <option value="">Select a team for invite generation</option>
        {teams.map((team) => (
          <option key={team.id} value={team.id}>
            {team.name}
          </option>
        ))}
      </select>
      <label className="grid gap-2 text-sm font-medium text-slate-700">
        <span>Invite expiry (hours)</span>
        <input
          className="rounded-2xl border border-slate-200 px-4 py-3"
          defaultValue={24}
          min={1}
          max={168}
          name="expiresInHours"
          type="number"
        />
        <span className="text-xs font-normal text-slate-500">
          Example: 24 means the invite link will expire after 24 hours.
        </span>
      </label>
      <button
        className="rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        disabled={teams.length === 0 || pending}
        type="submit"
      >
        {pending ? "Generating invite URL..." : submitLabel}
      </button>
      {state.ok && state.url ? (
        <div className="rounded-2xl border border-turf/30 bg-turf/10 px-4 py-3 text-sm text-slate-700">
          <div className="font-semibold text-turf">
            Invite created for {state.teamName ?? "selected team"}
          </div>
          <div className="mt-2 break-all text-xs text-turf">{state.url}</div>
          {state.expiresAt ? (
            <div className="mt-2 text-xs text-slate-600">
              Expires {new Date(state.expiresAt).toLocaleString()}
            </div>
          ) : null}
        </div>
      ) : null}
      {!state.ok && state.error ? (
        <div className="rounded-2xl border border-rose/30 bg-rose/10 px-4 py-3 text-sm text-rose">
          {state.error}
        </div>
      ) : null}
      {teams.length === 0 ? (
        <p className="text-sm text-slate-500">
          All teams already have owner accounts. Create a new team or reseed with
          invite-only demo data to generate more invites.
        </p>
      ) : null}
    </form>
  );
}
