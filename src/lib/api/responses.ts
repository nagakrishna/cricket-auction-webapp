import { NextResponse } from "next/server";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { ZodError } from "zod";

export function apiOk(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function apiError(
  message: string,
  status = 400,
  extra?: Record<string, unknown>,
) {
  return NextResponse.json(
    {
      error: message,
      ...extra,
    },
    { status },
  );
}

export function apiException(error: unknown) {
  if (error instanceof ZodError) {
    return apiError("Validation failed.", 400, {
      issues: error.issues,
    });
  }

  if (error instanceof PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return apiError("A record with this value already exists.", 409);
    }

    if (error.code === "P2025") {
      return apiError("Requested record was not found.", 404);
    }
  }

  if (error instanceof Error) {
    return apiError(error.message, 400);
  }

  return apiError("Unexpected server error.", 500);
}
