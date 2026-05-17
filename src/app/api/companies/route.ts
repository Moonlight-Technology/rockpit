import { NextResponse } from "next/server";
import { forbidden, getSessionUserId, unauthorized } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return unauthorized();
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { premiumUnlock: { select: { id: true } } },
  });

  if (!user?.premiumUnlock) {
    return forbidden("Company mode is locked.");
  }

  const companies = await prisma.company.findMany({
    where: { ownerId: userId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });

  return NextResponse.json({
    ok: true,
    data: companies,
    meta: { hasCompanyMode: true },
  });
}
