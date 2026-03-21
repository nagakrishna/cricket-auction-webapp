import { redeemInvite } from "@/server/invites/invite-service";
import { createSession } from "@/lib/auth/session";
import { apiFromServiceResult, withApiErrorHandling } from "@/lib/api/route-helpers";

export async function POST(request: Request) {
  return withApiErrorHandling(async () => {
    const result = await redeemInvite(await request.json());

    if (result.ok) {
      await createSession(result.userId);
    }

    return apiFromServiceResult(result);
  });
}
