import { NextResponse } from "next/server";
import { getSessionUserId, unauthorized, validationError } from "@/lib/api";
import { createMoneyTransaction, listMoneyTransactions } from "@/lib/money";
import { createMoneyTransactionSchema } from "@/lib/validators/money";

function currentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function isMonthValue(value: string) {
  return /^\d{4}-\d{2}$/.test(value);
}

export async function GET(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month") ?? currentMonthValue();
  if (!isMonthValue(month)) return validationError("Invalid month.");

  const data = await listMoneyTransactions(userId, month);
  return NextResponse.json({ ok: true, data });
}

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const payload = await req.json();
  const parsed = createMoneyTransactionSchema.safeParse(payload);
  if (!parsed.success) return validationError("Invalid transaction payload.");

  const result = await createMoneyTransaction(userId, parsed.data);
  if (!result.ok) {
    return validationError(result.message);
  }

  return NextResponse.json({ ok: true, data: result.data }, { status: 201 });
}
