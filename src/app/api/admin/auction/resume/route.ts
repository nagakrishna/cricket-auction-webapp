import { apiOk } from "@/lib/api/responses";
import { requireApiRoleOrError, withApiErrorHandling } from "@/lib/api/route-helpers";
import { resumeAuction } from "@/server/auction/auction-service";

export async function POST() {
  return withApiErrorHandling(async () => {
    const auth = await requireApiRoleOrError("ADMIN");

    if (!auth.ok) {
      return auth.response;
    }

    await resumeAuction(auth.session.user.id);
    return apiOk({ ok: true });
  });
}
