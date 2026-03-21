import {
  apiFromServiceResult,
  parseJsonBody,
  requireApiRoleOrError,
  withApiErrorHandling,
} from "@/lib/api/route-helpers";
import { resolveTimedOutPickSchema } from "@/lib/validation/auction";
import { pickPlayer } from "@/server/auction/auction-service";

export async function POST(request: Request) {
  return withApiErrorHandling(async () => {
    const auth = await requireApiRoleOrError("ADMIN");

    if (!auth.ok) {
      return auth.response;
    }

    const body = await parseJsonBody(request, resolveTimedOutPickSchema);
    return apiFromServiceResult(
      await pickPlayer(
        auth.session.user.id,
        body.roundId,
        body.playerId,
        "ADMIN",
      ),
    );
  });
}
