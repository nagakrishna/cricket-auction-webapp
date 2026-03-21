import { apiOk } from "@/lib/api/responses";
import { requireApiRoleOrError, withApiErrorHandling } from "@/lib/api/route-helpers";
import { startAuction } from "@/server/auction/auction-service";

export async function POST() {
  return withApiErrorHandling(async () => {
    const auth = await requireApiRoleOrError("ADMIN");

    if (!auth.ok) {
      return auth.response;
    }

    await startAuction(auth.session.user.id);
    return apiOk({ ok: true });
  });
}
