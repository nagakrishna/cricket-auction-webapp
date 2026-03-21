import { apiOk } from "@/lib/api/responses";
import { requireApiSessionOrError, withApiErrorHandling } from "@/lib/api/route-helpers";
import { getAuctionSnapshot } from "@/server/auction/auction-service";

export async function GET() {
  return withApiErrorHandling(async () => {
    const auth = await requireApiSessionOrError();

    if (!auth.ok) {
      return auth.response;
    }

    return apiOk({ snapshot: await getAuctionSnapshot() });
  });
}
