import { apiOk } from "@/lib/api/responses";
import { requireApiRoleOrError, withApiErrorHandling } from "@/lib/api/route-helpers";
import {
  getAuctionAdminData,
  updateAuctionSettings,
} from "@/server/admin/settings-service";

export async function GET() {
  return withApiErrorHandling(async () => {
    const auth = await requireApiRoleOrError("ADMIN");

    if (!auth.ok) {
      return auth.response;
    }

    return apiOk({ auction: await getAuctionAdminData() });
  });
}

export async function PUT(request: Request) {
  return withApiErrorHandling(async () => {
    const auth = await requireApiRoleOrError("ADMIN");

    if (!auth.ok) {
      return auth.response;
    }

    return apiOk({ auction: await updateAuctionSettings(await request.json()) });
  });
}
