import { NextResponse } from "next/server";
import { getSessionUserId, unauthorized, validationError } from "@/lib/api";
import { createMoneyCategory, listMoneyCategories, updateMoneyCategory } from "@/lib/money";
import { createMoneyCategorySchema, updateMoneyCategorySchema } from "@/lib/validators/money";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const data = await listMoneyCategories(userId);
  return NextResponse.json({ ok: true, data });
}

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const payload = await req.json();
  const parsed = createMoneyCategorySchema.safeParse(payload);
  if (!parsed.success) return validationError("Invalid category payload.");

  const data = await createMoneyCategory({ userId, ...parsed.data });
  return NextResponse.json({ ok: true, data }, { status: 201 });
}

export async function PATCH(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const payload = await req.json();
  const parsed = updateMoneyCategorySchema.safeParse(payload);
  if (!parsed.success) return validationError("Invalid category payload.");

  const result = await updateMoneyCategory({ userId, ...parsed.data });
  if (!result.ok) {
    return validationError(result.message);
  }

  return NextResponse.json({ ok: true, data: result.data });
}
