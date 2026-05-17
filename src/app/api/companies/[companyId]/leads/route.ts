import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  createLeadForUser,
  getLeadBoardForUser,
} from "@/lib/company-lead-service";
import { getSessionUserId, notFound, unauthorized, validationError } from "@/lib/api";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return unauthorized();
  }

  const { companyId } = await params;
  const board = await getLeadBoardForUser(userId, companyId);
  if (!board) {
    return notFound("Lead board not found.");
  }

  return NextResponse.json({ ok: true, data: board });
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

    const lead = await createLeadForUser({ userId, companyId, payload });
    if (!lead) {
      return notFound("Lead board or column not found.");
    }

    return NextResponse.json({ ok: true, data: lead }, { status: 201 });
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
