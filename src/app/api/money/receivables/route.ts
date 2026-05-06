import { NextResponse } from "next/server";
import { getSessionUserId, unauthorized, validationError } from "@/lib/api";
import { listReceivables, recordReceivablePayment } from "@/lib/money";
import { createReceivablePaymentSchema } from "@/lib/validators/money";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const data = await listReceivables(userId);
  return NextResponse.json({ ok: true, data });
}

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const payload = await req.json();
  const parsed = createReceivablePaymentSchema.safeParse(payload);
  if (!parsed.success) return validationError("Invalid receivable payment payload.");

  const result = await recordReceivablePayment(userId, parsed.data);
  if (!result.ok) {
    return validationError(result.message);
  }

  return NextResponse.json({ ok: true, data: result.data }, { status: 201 });
}
