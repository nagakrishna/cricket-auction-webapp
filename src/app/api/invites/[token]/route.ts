import { getInviteByToken } from "@/server/invites/invite-service";
import { apiOk, apiError } from "@/lib/api/responses";
import { withApiErrorHandling } from "@/lib/api/route-helpers";

type RouteProps = {
  params: Promise<{ token: string }>;
};

export async function GET(_request: Request, { params }: RouteProps) {
  return withApiErrorHandling(async () => {
    const { token } = await params;
    const invite = await getInviteByToken(token);

    if (!invite) {
      return apiError("Invite not found.", 404);
    }

    return apiOk(invite);
  });
}
