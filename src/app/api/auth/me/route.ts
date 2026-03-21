import { apiOk } from "@/lib/api/responses";
import { requireApiSessionOrError, withApiErrorHandling } from "@/lib/api/route-helpers";

export async function GET() {
  return withApiErrorHandling(async () => {
    const auth = await requireApiSessionOrError();

    if (!auth.ok) {
      return auth.response;
    }

    return apiOk({
      user: {
        id: auth.session.user.id,
        email: auth.session.user.email,
        role: auth.session.user.role,
        displayName: auth.session.user.displayName,
        teamId: auth.session.user.teamOwnerships[0]?.id ?? null,
      },
    });
  });
}
