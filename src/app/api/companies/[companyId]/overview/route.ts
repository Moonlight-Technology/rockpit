import { NextResponse } from "next/server";
import { forbidden, getSessionUserId, notFound, unauthorized } from "@/lib/api";
import { getHasCompanyMode } from "@/lib/auth";
import { getCompanyOverviewForUser } from "@/lib/company-overview";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return unauthorized();
  }

  if (!(await getHasCompanyMode(userId))) {
    return forbidden("Company mode is locked.");
  }

  const { companyId } = await params;
  const result = await getCompanyOverviewForUser(userId, companyId);
  if ("error" in result) {
    if (result.error === "FORBIDDEN") {
      return forbidden("Only the company owner can view overview metrics.");
    }

    return notFound("Company not found.");
  }

  return NextResponse.json({ ok: true, data: result });
}
