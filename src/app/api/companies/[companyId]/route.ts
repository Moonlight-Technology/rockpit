import { NextResponse } from "next/server";
import { forbidden, getSessionUserId, notFound, unauthorized } from "@/lib/api";
import { getCompanyForUser } from "@/lib/company-service";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return unauthorized();
  }

  const { companyId } = await params;
  const [user, company] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { premiumUnlock: { select: { id: true } } },
    }),
    getCompanyForUser(userId, companyId),
  ]);

  if (!company) {
    return notFound("Company not found.");
  }

  if (!user?.premiumUnlock) {
    return forbidden("Company mode is locked.");
  }

  return NextResponse.json({ ok: true, data: company });
}
