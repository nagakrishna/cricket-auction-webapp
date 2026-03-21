import { apiOk } from "@/lib/api/responses";
import { requireApiRoleOrError, withApiErrorHandling } from "@/lib/api/route-helpers";
import { createPlayer, listPlayers } from "@/server/players/player-service";

export async function GET() {
  return withApiErrorHandling(async () => {
    const auth = await requireApiRoleOrError("ADMIN");

    if (!auth.ok) {
      return auth.response;
    }

    return apiOk({ players: await listPlayers() });
  });
}

export async function POST(request: Request) {
  return withApiErrorHandling(async () => {
    const auth = await requireApiRoleOrError("ADMIN");

    if (!auth.ok) {
      return auth.response;
    }

    return apiOk({ player: await createPlayer(await request.json()) }, { status: 201 });
  });
}
