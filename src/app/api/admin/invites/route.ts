import { apiOk } from "@/lib/api/responses";
import { requireApiRoleOrError, withApiErrorHandling } from "@/lib/api/route-helpers";
import { createInvite, listInvites } from "@/server/invites/invite-service";

export async function GET() {
  return withApiErrorHandling(async () => {
    const auth = await requireApiRoleOrError("ADMIN");

    if (!auth.ok) {
      return auth.response;
    }

    return apiOk({ invites: await listInvites() });
  });
}

export async function POST(request: Request) {
  return withApiErrorHandling(async () => {
    const auth = await requireApiRoleOrError("ADMIN");

    if (!auth.ok) {
      return auth.response;
    }

    return apiOk(
      { invite: await createInvite(await request.json(), auth.session.user.id) },
      { status: 201 },
    );
  });
}
