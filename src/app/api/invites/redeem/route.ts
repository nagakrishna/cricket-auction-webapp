import { NextResponse } from "next/server";

import { redeemInvite } from "@/server/invites/invite-service";
import { createSession } from "@/lib/auth/session";
import { apiFromServiceResult, withApiErrorHandling } from "@/lib/api/route-helpers";
import { createRedirectUrl } from "@/lib/http/origin";

function mapInviteRedeemError(error: string) {
  switch (error) {
    case "Invite not found.":
      return "invite_invalid";
    case "Invite has expired.":
      return "invite_expired";
    case "Invite is no longer active.":
      return "invite_inactive";
    case "This team already has an owner account.":
      return "team_claimed";
    case "Email already in use.":
      return "email_in_use";
    default:
      return "activation_failed";
  }
}

export async function POST(request: Request) {
  return withApiErrorHandling(async () => {
    const contentType = request.headers.get("content-type") ?? "";
    const isJson = contentType.includes("application/json");
    const payload = isJson
      ? await request.json()
      : Object.fromEntries((await request.formData()).entries());

    const result = await redeemInvite(payload);

    if (result.ok) {
      await createSession(result.userId);

      if (!isJson) {
        return NextResponse.redirect(createRedirectUrl(request, "/owner/auction"), 303);
      }
    }

    if (!isJson && !result.ok) {
      const token = String(payload.token ?? "");
      return NextResponse.redirect(
        createRedirectUrl(
          request,
          `/invite/${token}?error=${encodeURIComponent(mapInviteRedeemError(result.error ?? ""))}`,
        ),
        303,
      );
    }

    return apiFromServiceResult(result);
  });
}
