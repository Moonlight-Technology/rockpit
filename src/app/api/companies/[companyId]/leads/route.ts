import { NextResponse } from "next/server";
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
    const payload = await req.json();
    const lead = await createLeadForUser({ userId, companyId, payload });
    if (!lead) {
      return notFound("Lead board or column not found.");
    }

    return NextResponse.json({ ok: true, data: lead }, { status: 201 });
  } catch {
    return validationError("Invalid lead payload.");
  }
}
