import { NextResponse } from "next/server";
import { getSessionUserId, unauthorized, validationError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { updateProfileForUser } from "@/lib/profile-service";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return unauthorized();
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, avatarColor: true },
  });
  if (!user) {
    return unauthorized();
  }

  return NextResponse.json({ ok: true, data: user });
}

export async function PATCH(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return unauthorized();
  }

  try {
    const result = await updateProfileForUser({ userId, payload: await req.json() });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return validationError("Invalid profile payload.");
    }

    if (error && typeof error === "object" && "issues" in error) {
      return validationError("Name or avatar color is invalid.");
    }

    console.error("profile_update_error", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: "Unable to update profile." } },
      { status: 500 }
    );
  }
}
