import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { forbidden, getSessionUserId, notFound, unauthorized, validationError } from "@/lib/api";
import {
  getInvoiceDetailForUser,
  updateInvoiceStatusForUser,
} from "@/lib/company-invoice-service";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ companyId: string; invoiceId: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return unauthorized();
  }

  const { companyId, invoiceId } = await params;
  const result = await getInvoiceDetailForUser({ userId, companyId, invoiceId });
  if ("error" in result) {
    if (result.error === "FORBIDDEN") {
      return forbidden("Only the company owner can view invoices.");
    }
    return notFound("Invoice not found.");
  }

  return NextResponse.json({ ok: true, data: result });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ companyId: string; invoiceId: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return unauthorized();
  }

  const { companyId, invoiceId } = await params;

  try {
    const payload = await req.json().catch(() => null);
    if (payload === null) {
      return validationError("Invalid JSON payload.");
    }

    const result = await updateInvoiceStatusForUser({
      userId,
      companyId,
      invoiceId,
      payload,
    });

    if ("error" in result) {
      if (result.error === "FORBIDDEN") {
        return forbidden("Only company owner can update invoice status.");
      }
      if (result.error === "INVALID_STATUS_TRANSITION") {
        return NextResponse.json(
          {
            ok: false,
            error: {
              code: "INVALID_STATUS_TRANSITION",
              message: "That invoice status transition is not allowed.",
            },
          },
          { status: 409 }
        );
      }
      return notFound("Invoice not found.");
    }

    return NextResponse.json({ ok: true, data: result.data });
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
