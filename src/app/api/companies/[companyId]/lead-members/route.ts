import { NextResponse } from "next/server";
import { addLeadBoardMemberByEmail } from "@/lib/company-lead-service";
import { forbidden, getSessionUserId, notFound, unauthorized, validationError } from "@/lib/api";
import { addMemberByEmailSchema } from "@/lib/validators/board";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return unauthorized();
  }

  const { companyId } = await params;
  const payload = await req.json();
  const parsed = addMemberByEmailSchema.safeParse(payload);
  if (!parsed.success) {
    return validationError("Valid email is required.");
  }

  const result = await addLeadBoardMemberByEmail({
    userId,
    companyId,
    email: parsed.data.email,
  });

  if (!result) {
    return notFound("Lead board not found.");
  }

  if ("error" in result) {
    if (result.error === "OWNER_ONLY") {
      return forbidden("Only company owner can invite lead board members.");
    }
    return notFound("User with this email is not registered.");
  }

  return NextResponse.json({ ok: true, data: result }, { status: 201 });
}
