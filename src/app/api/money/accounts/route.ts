import { NextResponse } from "next/server";
import { getSessionUserId, unauthorized, validationError } from "@/lib/api";
import { createMoneyAccount, listMoneyAccounts } from "@/lib/money";
import { createMoneyAccountSchema } from "@/lib/validators/money";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const data = await listMoneyAccounts(userId);
  return NextResponse.json({ ok: true, data });
}

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const payload = await req.json();
  const parsed = createMoneyAccountSchema.safeParse(payload);
  if (!parsed.success) return validationError("Invalid account payload.");

  const data = await createMoneyAccount({ userId, ...parsed.data });
  return NextResponse.json({ ok: true, data }, { status: 201 });
}
