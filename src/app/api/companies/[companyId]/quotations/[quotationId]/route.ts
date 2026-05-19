import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getSessionUserId, forbidden, notFound, unauthorized, validationError } from "@/lib/api";
import {
  createQuotationRevisionForUser,
  getQuotationDetailForUser,
  isQuotationConflictError,
  updateQuotationStatusForUser,
} from "@/lib/company-quotation-service";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ companyId: string; quotationId: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return unauthorized();
  }

  const { companyId, quotationId } = await params;
  const result = await getQuotationDetailForUser({ userId, companyId, quotationId });
  if ("error" in result) {
    if (result.error === "FORBIDDEN") {
      return forbidden("Only the company owner can view quotations.");
    }
    return notFound("Quotation not found.");
  }

  return NextResponse.json({ ok: true, data: result });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ companyId: string; quotationId: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return unauthorized();
  }

  const { companyId, quotationId } = await params;

  try {
    const payload = await req.json().catch(() => null);
    if (payload === null) {
      return validationError("Invalid JSON payload.");
    }

    const result = await createQuotationRevisionForUser({
      userId,
      companyId,
      quotationId,
      payload,
    });
    if ("error" in result) {
      if (result.error === "FORBIDDEN") {
        return forbidden("Only company owner can create quotation revisions.");
      }
      if (result.error === "LEAD_MISMATCH") {
        return validationError("Revision lead does not match the original quotation.");
      }
      return notFound("Quotation not found.");
    }

    return NextResponse.json({ ok: true, data: result.data }, { status: 201 });
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
            message: "Quotation revision allocation conflicted with another request. Please retry.",
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

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ companyId: string; quotationId: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return unauthorized();
  }

  const { companyId, quotationId } = await params;

  try {
    const payload = await req.json().catch(() => null);
    if (payload === null) {
      return validationError("Invalid JSON payload.");
    }

    const result = await updateQuotationStatusForUser({
      userId,
      companyId,
      quotationId,
      payload,
    });

    if ("error" in result) {
      if (result.error === "FORBIDDEN") {
        return forbidden("Only company owner can update quotation status.");
      }
      if (result.error === "NOT_LATEST_REVISION") {
        return NextResponse.json(
          {
            ok: false,
            error: {
              code: "NOT_LATEST_REVISION",
              message:
                "Only the latest revision can have its status updated. Open the latest revision and try again.",
            },
          },
          { status: 409 }
        );
      }
      return notFound("Quotation not found.");
    }

    return NextResponse.json({
      ok: true,
      data: result.data,
      warnings: result.warnings,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return validationError(error.issues[0]?.message ?? "Invalid status payload.");
    }
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: "Unexpected server error." } },
      { status: 500 }
    );
  }
}
