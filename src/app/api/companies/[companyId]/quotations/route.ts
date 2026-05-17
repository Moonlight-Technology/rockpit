import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getSessionUserId, forbidden, notFound, unauthorized, validationError } from "@/lib/api";
import {
  createQuotationForUser,
  listQuotationsForUser,
} from "@/lib/company-quotation-service";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return unauthorized();
  }

  const { companyId } = await params;
  const result = await listQuotationsForUser(userId, companyId);
  if ("error" in result) {
    if (result.error === "FORBIDDEN") {
      return forbidden("Only the company owner can view quotations.");
    }
    return notFound("Company not found.");
  }

  return NextResponse.json({ ok: true, data: result });
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

    const result = await createQuotationForUser({ userId, companyId, payload });
    if ("error" in result) {
      if (result.error === "FORBIDDEN") {
        return forbidden("Only company owner can create quotations.");
      }
      return notFound("Lead or company not found.");
    }

    return NextResponse.json({ ok: true, data: result.data }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return validationError(error.issues[0]?.message ?? "Invalid quotation payload.");
    }

    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: "Unexpected server error." } },
      { status: 500 }
    );
  }
}
