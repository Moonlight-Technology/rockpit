import { NextResponse } from "next/server";
import { deleteLeadForUser, updateLeadForUser } from "@/lib/company-lead-service";
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

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ companyId: string; leadId: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return unauthorized();
  }

  const { companyId, leadId } = await params;
  const result = await deleteLeadForUser({ userId, companyId, leadId });
  if (!result) {
    return notFound("Lead not found.");
  }

  return NextResponse.json({ ok: true, data: result });
}
