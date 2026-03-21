import {
  apiFromServiceResult,
  parseJsonBody,
  requireApiRoleOrError,
  withApiErrorHandling,
} from "@/lib/api/route-helpers";
import { nominatePlayerSchema } from "@/lib/validation/auction";
import { nominatePlayer } from "@/server/auction/auction-service";

export async function POST(request: Request) {
  return withApiErrorHandling(async () => {
    const auth = await requireApiRoleOrError("TEAM_OWNER");

    if (!auth.ok) {
      return auth.response;
    }

    const body = await parseJsonBody(request, nominatePlayerSchema);
    return apiFromServiceResult(
      await nominatePlayer(auth.session.user.id, body.roundId, body.playerId),
    );
  });
}
