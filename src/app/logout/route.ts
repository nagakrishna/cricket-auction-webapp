import { NextResponse } from "next/server";

import { destroySession } from "@/lib/auth/session";
import { createRedirectUrl } from "@/lib/http/origin";

export async function POST(request: Request) {
  await destroySession();
  return NextResponse.redirect(createRedirectUrl(request, "/login"), 303);
}
