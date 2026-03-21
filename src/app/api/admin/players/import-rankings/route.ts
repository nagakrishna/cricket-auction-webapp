import { apiError, apiOk } from "@/lib/api/responses";
import { requireApiRoleOrError, withApiErrorHandling } from "@/lib/api/route-helpers";
import { importRankingCsv } from "@/server/players/player-service";

export async function POST(request: Request) {
  return withApiErrorHandling(async () => {
    const auth = await requireApiRoleOrError("ADMIN");

    if (!auth.ok) {
      return auth.response;
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return apiError("CSV file is required.", 400);
    }

    return apiOk(await importRankingCsv(await file.text()));
  });
}
