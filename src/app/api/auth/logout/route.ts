import { destroySession } from "@/lib/auth/session";
import { apiOk } from "@/lib/api/responses";
import { withApiErrorHandling } from "@/lib/api/route-helpers";

export async function POST() {
  return withApiErrorHandling(async () => {
    await destroySession();
    return apiOk({ ok: true });
  });
}
