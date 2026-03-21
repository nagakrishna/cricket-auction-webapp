"use server";

import { redirect } from "next/navigation";

import { createSession } from "@/lib/auth/session";
import { redeemInvite } from "@/server/invites/invite-service";

export async function redeemInviteAction(formData: FormData) {
  const result = await redeemInvite({
    token: formData.get("token"),
    displayName: formData.get("displayName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!result.ok) {
    return;
  }

  await createSession(result.userId);
  redirect("/owner/auction");
}
