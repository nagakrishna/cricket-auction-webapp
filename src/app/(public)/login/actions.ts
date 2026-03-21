"use server";

import { redirect } from "next/navigation";

import { createSession } from "@/lib/auth/session";
import { login } from "@/server/auth/auth-service";

export async function loginAction(formData: FormData) {
  const result = await login({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!result.ok) {
    return;
  }

  await createSession(result.userId);
  redirect(result.role === "ADMIN" ? "/admin" : "/owner/auction");
}
