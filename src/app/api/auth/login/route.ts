import { NextResponse } from "next/server";

import { login } from "@/server/auth/auth-service";
import { createSession } from "@/lib/auth/session";
import { apiFromServiceResult, withApiErrorHandling } from "@/lib/api/route-helpers";
import { createRedirectUrl } from "@/lib/http/origin";

export async function POST(request: Request) {
  return withApiErrorHandling(async () => {
    const contentType = request.headers.get("content-type") ?? "";
    const isJson = contentType.includes("application/json");
    const payload = isJson
      ? await request.json()
      : Object.fromEntries((await request.formData()).entries());

    const result = await login(payload);

    if (result.ok) {
      await createSession(result.userId);

      if (!isJson) {
        return NextResponse.redirect(
          createRedirectUrl(request, result.role === "ADMIN" ? "/admin" : "/owner/auction"),
          303,
        );
      }
    }

    if (!isJson && !result.ok) {
      return NextResponse.redirect(createRedirectUrl(request, "/login?error=invalid_credentials"), 303);
    }

    return apiFromServiceResult(result, 401);
  });
}
