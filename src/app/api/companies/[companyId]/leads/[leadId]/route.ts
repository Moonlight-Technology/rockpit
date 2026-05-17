import { NextResponse } from "next/server";
import { updateLeadForUser } from "@/lib/company-lead-service";
import { getSessionUserId, notFound, unauthorized, validationError } from "@/lib/api";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ companyId: string; leadId: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return unauthorized();
  }

  const { companyId, leadId } = await params;

  try {
    const payload = await req.json();
    const lead = await updateLeadForUser({ userId, companyId, leadId, payload });
    if (!lead) {
      return notFound("Lead not found.");
    }

    return NextResponse.json({ ok: true, data: lead });
  } catch {
    return validationError("Invalid lead update payload.");
  }
}
