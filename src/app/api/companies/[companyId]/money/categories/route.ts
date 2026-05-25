import { NextResponse } from "next/server";
import {
  forbidden,
  getSessionUserId,
  notFound,
  unauthorized,
  validationError,
} from "@/lib/api";
import {
  createCompanyMoneyCategory,
  listCompanyMoneyCategories,
  updateCompanyMoneyCategory,
} from "@/lib/company-money-service";
import {
  createCompanyMoneyCategorySchema,
  updateCompanyMoneyCategorySchema,
} from "@/lib/validators/company-money";

function companyAccessError(error: "FORBIDDEN" | "NOT_FOUND") {
  return error === "FORBIDDEN"
    ? forbidden("Only company owner can access expense manager.")
    : notFound("Company not found.");
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const { companyId } = await params;
  const result = await listCompanyMoneyCategories({ userId, companyId });
  if ("error" in result) return companyAccessError(result.error);

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

  const parsed = createCompanyMoneyCategorySchema.safeParse(payload);
  if (!parsed.success) return validationError("Invalid category payload.");

  const { companyId } = await params;
  const result = await createCompanyMoneyCategory({ userId, companyId, ...parsed.data });
  if ("error" in result) return companyAccessError(result.error);

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

  const parsed = updateCompanyMoneyCategorySchema.safeParse(payload);
  if (!parsed.success) return validationError("Invalid category payload.");

  const { companyId } = await params;
  const result = await updateCompanyMoneyCategory({ userId, companyId, ...parsed.data });
  if ("error" in result) {
    if (result.error === "FORBIDDEN" || result.error === "NOT_FOUND") {
      return result.message ? validationError(result.message) : companyAccessError(result.error);
    }
  }

  return NextResponse.json({ ok: true, data: result.data });
}
