import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { updateLeadForUser } from "@/lib/company-lead-service";
import { forbidden, getSessionUserId, notFound, unauthorized, validationError } from "@/lib/api";

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

    const result = await updateLeadForUser({ userId, companyId, leadId, payload });
    if ("error" in result) {
      if (result.error === "FORBIDDEN") {
        return forbidden("Only company owner can update leads.");
      }
      if (result.error === "INVALID_COLUMN") {
        return validationError("Selected lead column is invalid.");
      }
      return notFound("Lead not found.");
    }

    return NextResponse.json({ ok: true, data: result.data });
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
