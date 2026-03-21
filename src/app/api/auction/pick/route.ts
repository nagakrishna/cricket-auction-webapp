import {
  apiFromServiceResult,
  parseJsonBody,
  requireApiRoleOrError,
  withApiErrorHandling,
} from "@/lib/api/route-helpers";
import { pickPlayerSchema } from "@/lib/validation/auction";
import { pickPlayer } from "@/server/auction/auction-service";

export async function POST(request: Request) {
  return withApiErrorHandling(async () => {
    const auth = await requireApiRoleOrError("TEAM_OWNER");

    if (!auth.ok) {
      return auth.response;
    }

    const body = await parseJsonBody(request, pickPlayerSchema);
    return apiFromServiceResult(
      await pickPlayer(
        auth.session.user.id,
        body.roundId,
        body.playerId,
        "OWNER",
      ),
    );
  });
}
