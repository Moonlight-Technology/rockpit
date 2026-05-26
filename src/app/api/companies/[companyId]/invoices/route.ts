import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { forbidden, getSessionUserId, notFound, unauthorized, validationError } from "@/lib/api";
import { createInvoiceForUser, listInvoicesForUser } from "@/lib/company-invoice-service";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return unauthorized();
  }

  const { companyId } = await params;
  const result = await listInvoicesForUser(userId, companyId);
  if ("error" in result) {
    if (result.error === "FORBIDDEN") {
      return forbidden("Only the company owner can view invoices.");
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

    const result = await createInvoiceForUser({ userId, companyId, payload });
    if ("error" in result) {
      if (result.error === "FORBIDDEN") {
        return forbidden("Only company owner can create invoices.");
      }
      if (result.error === "QUOTATION_NOT_APPROVED") {
        return NextResponse.json(
          {
            ok: false,
            error: {
              code: "QUOTATION_NOT_APPROVED",
              message: "Invoice can only be created from an approved quotation.",
            },
          },
          { status: 409 }
        );
      }
      if (result.error === "INVOICE_TOTAL_EXCEEDS_QUOTATION") {
        return NextResponse.json(
          {
            ok: false,
            error: {
              code: "INVOICE_TOTAL_EXCEEDS_QUOTATION",
              message: "Invoice total exceeds the remaining approved quotation amount.",
            },
          },
          { status: 409 }
        );
      }
      return notFound("Quotation or company not found.");
    }

    return NextResponse.json({ ok: true, data: result.data }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return validationError(error.issues[0]?.message ?? "Invalid invoice payload.");
    }

    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: "Unexpected server error." } },
      { status: 500 }
    );
  }
}
