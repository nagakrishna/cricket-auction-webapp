import { AuctionRoom } from "@/components/auction/auction-room";
import { requireRole } from "@/lib/auth/session";
import { getAuctionSnapshot } from "@/server/auction/auction-service";

export default async function OwnerAuctionPage() {
  const user = await requireRole("TEAM_OWNER");
  const snapshot = await getAuctionSnapshot();
  const ownerTeamId = user.teamOwnerships[0]?.id;

  if (!ownerTeamId) {
    return (
      <div className="rounded-[1.75rem] border border-white/60 bg-white/85 p-6 text-sm text-slate-600 shadow-panel">
        Your account is active, but no team has been linked yet. Ask the admin to verify the invite redemption.
      </div>
    );
  }

  return (
    <AuctionRoom
      focus="auction"
      initialSnapshot={snapshot}
      ownerTeamId={ownerTeamId}
    />
  );
}
