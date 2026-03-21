import {
  apiFromServiceResult,
  parseJsonBody,
  requireApiRoleOrError,
  withApiErrorHandling,
} from "@/lib/api/route-helpers";
import { passBidSchema } from "@/lib/validation/auction";
import { passOnBid } from "@/server/auction/auction-service";

export async function POST(request: Request) {
  return withApiErrorHandling(async () => {
    const auth = await requireApiRoleOrError("TEAM_OWNER");

    if (!auth.ok) {
      return auth.response;
    }

    const body = await parseJsonBody(request, passBidSchema);
    return apiFromServiceResult(
      await passOnBid(auth.session.user.id, body.roundId),
    );
  });
}
