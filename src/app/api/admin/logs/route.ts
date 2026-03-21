import { apiOk } from "@/lib/api/responses";
import { requireApiRoleOrError, withApiErrorHandling } from "@/lib/api/route-helpers";
import { listAuditLogs } from "@/server/logs/audit-log";

export async function GET() {
  return withApiErrorHandling(async () => {
    const auth = await requireApiRoleOrError("ADMIN");

    if (!auth.ok) {
      return auth.response;
    }

    return apiOk({ logs: await listAuditLogs() });
  });
}
