import {
  apiFromServiceResult,
  parseJsonBody,
  requireApiRoleOrError,
  withApiErrorHandling,
} from "@/lib/api/route-helpers";
import { bidSchema } from "@/lib/validation/auction";
import { placeBid } from "@/server/auction/auction-service";

export async function POST(request: Request) {
  return withApiErrorHandling(async () => {
    const auth = await requireApiRoleOrError("TEAM_OWNER");

    if (!auth.ok) {
      return auth.response;
    }

    const body = await parseJsonBody(request, bidSchema);
    return apiFromServiceResult(
      await placeBid(auth.session.user.id, body.roundId, body.amount),
    );
  });
}
