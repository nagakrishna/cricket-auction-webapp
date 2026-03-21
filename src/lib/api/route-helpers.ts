import { requireApiRole, requireApiSession } from "@/lib/api/auth";
import { apiError, apiException, apiOk } from "@/lib/api/responses";
import type { ZodType } from "zod";

type ApiRole = "ADMIN" | "TEAM_OWNER";
type ServiceResult = {
  ok: boolean;
  error?: string;
};

export async function withApiErrorHandling<T>(action: () => Promise<T>) {
  try {
    return await action();
  } catch (error) {
    return apiException(error);
  }
}

export async function requireApiRoleOrError(role: ApiRole) {
  const session = await requireApiRole(role);

  if (!session) {
    return {
      ok: false as const,
      response: apiError(
        role === "ADMIN" ? "Forbidden" : "Unauthorized",
        role === "ADMIN" ? 403 : 401,
      ),
    };
  }

  return {
    ok: true as const,
    session,
  };
}

export async function requireApiSessionOrError() {
  const session = await requireApiSession();

  if (!session) {
    return {
      ok: false as const,
      response: apiError("Unauthorized", 401),
    };
  }

  return {
    ok: true as const,
    session,
  };
}

export async function parseJsonBody<TSchema extends ZodType>(
  request: Request,
  schema: TSchema,
) {
  return schema.parse(await request.json());
}

export function apiFromServiceResult(
  result: ServiceResult,
  failureStatus = 400,
) {
  if (!result.ok) {
    return apiError(result.error ?? "Request failed.", failureStatus);
  }

  return apiOk(result);
}
