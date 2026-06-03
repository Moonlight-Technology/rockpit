import { NextResponse } from "next/server";
import {
  forbidden,
  getSessionUserId,
  notFound,
  unauthorized,
  validationError,
} from "@/lib/api";
import {
  createCompanyWishlistItem,
  listCompanyWishlistItems,
  updateCompanyWishlistItemStatus,
} from "@/lib/company-money-service";
import {
  createCompanyWishlistItemSchema,
  updateCompanyWishlistItemSchema,
} from "@/lib/validators/company-money";

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
  _req: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const { companyId } = await params;
  const result = await listCompanyWishlistItems({ userId, companyId });
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

  const parsed = createCompanyWishlistItemSchema.safeParse(payload);
  if (!parsed.success) return validationError("Invalid wishlist payload.");

  const { companyId } = await params;
  const result = await createCompanyWishlistItem({ userId, companyId, ...parsed.data });
  if (!("data" in result)) return companyAccessError(result.error);

  return NextResponse.json({ ok: true, data: result.data }, { status: 201 });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const payload = await req.json().catch(() => null);
  if (payload === null) return validationError("Invalid JSON payload.");

  const parsed = updateCompanyWishlistItemSchema.safeParse(payload);
  if (!parsed.success) return validationError("Invalid wishlist payload.");

  const { companyId } = await params;
  const result = await updateCompanyWishlistItemStatus({ userId, companyId, ...parsed.data });
  if (!("data" in result)) {
    if ("message" in result && typeof result.message === "string") {
      return validationError(result.message);
    }
    return companyAccessError(result.error);
  }

  return NextResponse.json({ ok: true, data: result.data });
}
