import { NextResponse } from "next/server";
import { getSessionUserId, unauthorized, validationError } from "@/lib/api";
import { isValidCompanyUnlockCode } from "@/lib/company-premium";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return unauthorized();
  }

  const payload = await req.json().catch(() => null);
  const code = typeof payload?.code === "string" ? payload.code : "";
  if (!isValidCompanyUnlockCode(code)) {
    return validationError("Invalid premium code.");
  }

  await prisma.userPremiumUnlock.upsert({
    where: { userId },
    create: { userId, unlockSource: "manual_code" },
    update: {},
  });

  return NextResponse.json({ ok: true });
}
