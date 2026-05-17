import { NextResponse } from "next/server";
import { ZodError } from "zod";
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
    const payload = await req.json().catch(() => null);
    if (payload === null) {
      return validationError("Invalid JSON payload.");
    }

    const lead = await updateLeadForUser({ userId, companyId, leadId, payload });
    if (!lead) {
      return notFound("Lead not found.");
    }

    return NextResponse.json({ ok: true, data: lead });
  } catch (error) {
    if (error instanceof ZodError) {
      return validationError(error.issues[0]?.message ?? "Invalid lead update payload.");
    }

    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: "Unexpected server error." } },
      { status: 500 }
    );
  }
}
