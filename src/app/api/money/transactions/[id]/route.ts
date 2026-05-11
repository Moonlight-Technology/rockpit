import { NextResponse } from "next/server";
import { deleteMoneyTransaction, updateMoneyTransaction } from "@/lib/money";
import { getSessionUserId, notFound, unauthorized, validationError } from "@/lib/api";
import { updateMoneyTransactionSchema } from "@/lib/validators/money";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  const payload = await req.json();
  const parsed = updateMoneyTransactionSchema.safeParse(payload);
  if (!parsed.success) return validationError("Invalid transaction payload.");

  const result = await updateMoneyTransaction(userId, id, parsed.data);
  if (!result.ok) {
    return result.status === "not_found" ? notFound(result.message) : validationError(result.message);
  }

  return NextResponse.json({ ok: true, data: result.data });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  const result = await deleteMoneyTransaction(userId, id);
  if (!result.ok) {
    return result.status === "not_found" ? notFound(result.message) : validationError(result.message);
  }

  return NextResponse.json({ ok: true });
}
