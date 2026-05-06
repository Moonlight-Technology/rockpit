import { NextResponse } from "next/server";
import { getSessionUserId, unauthorized, validationError } from "@/lib/api";
import { createWishlistItem, listWishlistItems } from "@/lib/money";
import { createWishlistItemSchema } from "@/lib/validators/money";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const data = await listWishlistItems(userId);
  return NextResponse.json({ ok: true, data });
}

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const payload = await req.json();
  const parsed = createWishlistItemSchema.safeParse(payload);
  if (!parsed.success) return validationError("Invalid wishlist payload.");

  const data = await createWishlistItem({ userId, ...parsed.data });
  return NextResponse.json({ ok: true, data }, { status: 201 });
}
