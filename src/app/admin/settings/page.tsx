import { updateSettingsAction } from "@/app/admin/_actions/actions";
import { Panel } from "@/components/ui/panel";
import { getAuctionAdminData } from "@/server/admin/settings-service";

export default async function SettingsPage() {
  const auction = await getAuctionAdminData();
  const settings = auction.settings;

  const fields = [
    ["biddingTimerSeconds", "Bidding timer (seconds)", auction.biddingTimerSeconds, 10, 300],
    ["selectionTimerSeconds", "Nomination timer (seconds)", auction.selectionTimerSeconds, 10, 300],
    ["snakeTimerSeconds", "Snake timer (seconds)", auction.snakeTimerSeconds, 10, 300],
    ["startingBidAmount", "Starting bid amount", auction.startingBidAmount ?? 30, 1, 5000],
    ["auctionPlayers", "Bidding picks per team", Math.max(3, auction.biddingRoundSize), 3, 50],
    ["totalTeams", "Total teams", settings.totalTeams, 2, 20],
    ["rosterSize", "Roster size", settings.rosterSize, 8, 20],
    ["minBatsmen", "Min batsmen", settings.minBatsmen, 0, 12],
    ["maxBatsmen", "Max batsmen", settings.maxBatsmen, 0, 12],
    ["minBowlers", "Min bowlers", settings.minBowlers, 0, 12],
    ["maxBowlers", "Max bowlers", settings.maxBowlers, 0, 12],
    ["minAllRounders", "Min all-rounders", settings.minAllRounders, 0, 12],
    ["maxAllRounders", "Max all-rounders", settings.maxAllRounders, 0, 12],
    ["minWicketkeepers", "Min wicketkeepers", settings.minWicketkeepers, 0, 12],
    ["maxWicketkeepers", "Max wicketkeepers", settings.maxWicketkeepers, 0, 12],
  ] as const;

  return (
    <Panel title="Auction settings" eyebrow="Rules">
      <form action={updateSettingsAction} className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-slate-700 md:col-span-2">
          <span className="flex items-center gap-3">
            <input
              defaultChecked={auction.allowPassOnPlayer ?? false}
              name="allowPassOnPlayer"
              type="checkbox"
              value="true"
            />
            Allow pass on player during bidding
          </span>
        </label>
        {fields.map(([name, label, value, min, max]) => (
          <label key={name} className="grid gap-2 text-sm font-medium text-slate-700">
            {label}
            <input
              className="rounded-2xl border border-slate-200 px-4 py-3"
              defaultValue={value}
              max={max}
              min={min}
              name={name}
              required
              step={1}
              type="number"
            />
          </label>
        ))}
        <button className="rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white md:col-span-2" type="submit">
          Save settings
        </button>
      </form>
    </Panel>
  );
}
