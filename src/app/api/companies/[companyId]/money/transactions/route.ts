import { NextResponse } from "next/server";
import {
  forbidden,
  getSessionUserId,
  notFound,
  unauthorized,
  validationError,
} from "@/lib/api";
import {
  createCompanyMoneyTransaction,
  listCompanyMoneyTransactions,
} from "@/lib/company-money-service";
import { createCompanyMoneyTransactionSchema } from "@/lib/validators/company-money";

function currentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function isMonthValue(value: string) {
  return /^\d{4}-\d{2}$/.test(value);
}

function companyAccessError(error: "FORBIDDEN" | "NOT_FOUND" | "INVALID_STATE") {
  if (error === "FORBIDDEN") {
    return forbidden("Only company owner can access expense manager.");
  }
  if (error === "NOT_FOUND") {
    return notFound("Company not found.");
  }
  return validationError("Invalid expense manager request.");
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month") ?? currentMonthValue();
  if (!isMonthValue(month)) return validationError("Invalid month.");

  const { companyId } = await params;
  const result = await listCompanyMoneyTransactions({ userId, companyId, month });
  if (!("data" in result)) return companyAccessError(result.error);

  return NextResponse.json({ ok: true, data: result.data });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const payload = await req.json().catch(() => null);
  if (payload === null) return validationError("Invalid JSON payload.");

  const parsed = createCompanyMoneyTransactionSchema.safeParse(payload);
  if (!parsed.success) return validationError("Invalid transaction payload.");

  const { companyId } = await params;
  const result = await createCompanyMoneyTransaction({ userId, companyId, payload: parsed.data });
  if (!("data" in result)) {
    if ("message" in result && typeof result.message === "string") {
      return validationError(result.message);
    }
    return companyAccessError(result.error);
  }

  return NextResponse.json({ ok: true, data: result.data }, { status: 201 });
}
