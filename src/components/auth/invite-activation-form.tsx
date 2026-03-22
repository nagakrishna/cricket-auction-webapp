"use client";

import { useState } from "react";

type InviteActivationFormProps = {
  token: string;
};

export function InviteActivationForm({ token }: InviteActivationFormProps) {
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      action="/api/invites/redeem"
      aria-busy={submitting}
      className={`grid gap-4 transition-opacity ${submitting ? "opacity-80" : ""}`}
      method="POST"
      onSubmit={() => setSubmitting(true)}
    >
      <input name="token" type="hidden" value={token} />
      <label className="grid gap-2 text-sm font-medium text-slate-700">
        Your name
        <input
          required
          className="rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-turf"
          name="displayName"
          type="text"
        />
      </label>
      <label className="grid gap-2 text-sm font-medium text-slate-700">
        Email
        <input
          required
          className="rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-turf"
          name="email"
          type="email"
        />
      </label>
      <label className="grid gap-2 text-sm font-medium text-slate-700">
        Password
        <input
          required
          className="rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-turf"
          minLength={8}
          name="password"
          type="password"
        />
      </label>
      <button
        className="rounded-2xl bg-turf px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
        disabled={submitting}
        type="submit"
      >
        {submitting ? "Activating account..." : "Activate owner account"}
      </button>
    </form>
  );
}
