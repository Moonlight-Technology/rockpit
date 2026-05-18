import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createLeadForUser, getLeadBoardAccessForUser } from "@/lib/company-lead-service";
import { forbidden, getSessionUserId, notFound, unauthorized, validationError } from "@/lib/api";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return unauthorized();
  }

  const { companyId } = await params;
  const result = await getLeadBoardAccessForUser(userId, companyId);
  if ("error" in result) {
    if (result.error === "FORBIDDEN") {
      return forbidden("Lead board access denied.");
    }
    return notFound("Lead board not found.");
  }

  return NextResponse.json({ ok: true, data: result.board });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return unauthorized();
  }

  const { companyId } = await params;

  try {
    const payload = await req.json().catch(() => null);
    if (payload === null) {
      return validationError("Invalid JSON payload.");
    }

    const result = await createLeadForUser({ userId, companyId, payload });
    if ("error" in result) {
      if (result.error === "FORBIDDEN") {
        return forbidden("Only company owner can create leads.");
      }
      if (result.error === "INVALID_COLUMN") {
        return validationError("Selected lead column is invalid.");
      }
      if (result.error === "INVALID_CLIENT") {
        return validationError("Selected client is invalid.");
      }
      return notFound("Lead board not found.");
    }

    return NextResponse.json({ ok: true, data: result.data }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return validationError(error.issues[0]?.message ?? "Invalid lead payload.");
    }

    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: "Unexpected server error." } },
      { status: 500 }
    );
  }
}
