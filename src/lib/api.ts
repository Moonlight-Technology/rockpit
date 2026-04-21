import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function getSessionUserId() {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

export function unauthorized() {
  return NextResponse.json(
    { ok: false, error: { code: "UNAUTHORIZED", message: "Authentication required." } },
    { status: 401 }
  );
}

export function forbidden(message = "Access denied.") {
  return NextResponse.json(
    { ok: false, error: { code: "FORBIDDEN", message } },
    { status: 403 }
  );
}

export function notFound(message = "Resource not found.") {
  return NextResponse.json(
    { ok: false, error: { code: "NOT_FOUND", message } },
    { status: 404 }
  );
}

export function validationError(message = "Invalid payload.") {
  return NextResponse.json(
    { ok: false, error: { code: "VALIDATION_ERROR", message } },
    { status: 422 }
  );
}
