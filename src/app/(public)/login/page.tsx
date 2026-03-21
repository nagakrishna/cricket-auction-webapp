import Link from "next/link";

import { Shell } from "@/components/layout/shell";
import { Panel } from "@/components/ui/panel";

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const showInvalidCredentials = params?.error === "invalid_credentials";

  return (
    <Shell
      title="Access the fantasy auction"
      description="Admins run setup and live controls here. Invited team owners sign in after redeeming their team invite and rejoin the fantasy auction without losing live state."
    >
      <div className="mx-auto w-full max-w-xl">
        <Panel
          title="Account access"
          eyebrow="Authentication"
          className="border-rose-200/50 bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.12),transparent_28%),radial-gradient(circle_at_top_right,rgba(12,135,94,0.10),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.99),rgba(255,248,244,0.95))] shadow-[0_26px_56px_rgba(15,23,42,0.10)]"
        >
          <div className="mb-4 rounded-[1.5rem] border border-turf/20 bg-[linear-gradient(135deg,rgba(12,135,94,0.16),rgba(255,255,255,0.98))] px-5 py-4 text-sm text-slate-700 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-[0.22em] text-turf">
              Quick note
            </div>
            <div className="mt-2 leading-6">
              Use this page if your account already exists. First-time team owners should open their invite link first to create their password.
            </div>
          </div>
          <form action="/api/auth/login" className="grid gap-4" method="POST">
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Email
              <input
                required
                className="rounded-2xl border border-white/80 bg-white/92 px-4 py-3 outline-none ring-0 shadow-sm transition focus:border-turf"
                name="email"
                type="email"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Password
              <input
                required
                className="rounded-2xl border border-white/80 bg-white/92 px-4 py-3 outline-none ring-0 shadow-sm transition focus:border-turf"
                name="password"
                type="password"
              />
            </label>
            {showInvalidCredentials ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                Invalid credentials.
              </div>
            ) : null}
            <button
              className="rounded-2xl bg-[linear-gradient(135deg,#081420,#0c875e)] px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(12,135,94,0.18)] transition hover:brightness-105"
              type="submit"
            >
              Sign in
            </button>
          </form>
          <div className="mt-5 grid gap-3">
            <div className="rounded-2xl border border-white/70 bg-white/76 px-4 py-3 text-sm text-slate-600 shadow-sm">
              Need onboarding access? Ask the admin to generate a team invite for your franchise.
            </div>
          </div>
          <Link className="mt-4 inline-flex items-center rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-white" href="/">
            Back to home
          </Link>
          <p className="mt-3 text-xs text-slate-400">
            Admin and owner access share the same sign-in page.
          </p>
        </Panel>
      </div>
    </Shell>
  );
}
