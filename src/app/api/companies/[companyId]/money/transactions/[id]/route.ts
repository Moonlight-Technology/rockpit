import { NextResponse } from "next/server";
import {
  forbidden,
  getSessionUserId,
  notFound,
  unauthorized,
  validationError,
} from "@/lib/api";
import {
  deleteCompanyMoneyTransaction,
  updateCompanyMoneyTransaction,
} from "@/lib/company-money-service";
import { updateCompanyMoneyTransactionSchema } from "@/lib/validators/company-money";

function companyAccessError(error: "FORBIDDEN" | "NOT_FOUND") {
  return error === "FORBIDDEN"
    ? forbidden("Only company owner can access expense manager.")
    : notFound("Company not found.");
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ companyId: string; id: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const payload = await req.json().catch(() => null);
  if (payload === null) return validationError("Invalid JSON payload.");

  const parsed = updateCompanyMoneyTransactionSchema.safeParse(payload);
  if (!parsed.success) return validationError("Invalid transaction payload.");

  const { companyId, id } = await params;
  const result = await updateCompanyMoneyTransaction({
    userId,
    companyId,
    transactionId: id,
    payload: parsed.data,
  });
  if ("error" in result) {
    if (result.error === "FORBIDDEN" && !result.message) return companyAccessError(result.error);
    if (result.error === "NOT_FOUND" && !result.message) return notFound("Transaction not found.");
    return validationError(result.message ?? "Invalid transaction payload.");
  }

  return NextResponse.json({ ok: true, data: result.data });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ companyId: string; id: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const { companyId, id } = await params;
  const result = await deleteCompanyMoneyTransaction({
    userId,
    companyId,
    transactionId: id,
  });
  if ("error" in result) {
    if (result.error === "FORBIDDEN" && !result.message) return companyAccessError(result.error);
    if (result.error === "NOT_FOUND" && !result.message) return notFound("Transaction not found.");
    return validationError(result.message ?? "Invalid transaction payload.");
  }

  return NextResponse.json({ ok: true });
}
