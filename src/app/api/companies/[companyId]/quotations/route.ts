import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getSessionUserId, forbidden, notFound, unauthorized, validationError } from "@/lib/api";
import {
  createQuotationForUser,
  isQuotationConflictError,
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
      if (result.error === "LEAD_LOST_REQUIRES_REVIVE") {
        return NextResponse.json(
          {
            ok: false,
            error: {
              code: "LEAD_LOST_REQUIRES_REVIVE",
              message:
                "Lead is currently marked Lost. Confirm to revive it before creating a quotation.",
            },
          },
          { status: 409 }
        );
      }
      if (result.error === "NEGOTIATION_COLUMN_NOT_FOUND") {
        return NextResponse.json(
          {
            ok: false,
            error: {
              code: "NEGOTIATION_COLUMN_NOT_FOUND",
              message:
                "Cannot revive the lead because there is no 'Negotiation' column on the board.",
            },
          },
          { status: 400 }
        );
      }
      return notFound("Lead or company not found.");
    }

    return NextResponse.json(
      { ok: true, data: result.data, warnings: result.warnings },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return validationError(error.issues[0]?.message ?? "Invalid quotation payload.");
    }
    if (isQuotationConflictError(error)) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "CONFLICT",
            message: "Quotation number allocation conflicted with another request. Please retry.",
          },
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: "Unexpected server error." } },
      { status: 500 }
    );
  }
}
