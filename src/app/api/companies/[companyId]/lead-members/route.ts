import { NextResponse } from "next/server";
import { ZodError } from "zod";
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
  const payload = await req.json().catch(() => null);
  if (payload === null) {
    return validationError("Invalid JSON payload.");
  }

  const parsed = addMemberByEmailSchema.safeParse(payload);
  if (!parsed.success) {
    return validationError("Valid email is required.");
  }

  try {
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
  } catch (error) {
    if (error instanceof ZodError) {
      return validationError(error.issues[0]?.message ?? "Invalid lead board member payload.");
    }

    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: "Unexpected server error." } },
      { status: 500 }
    );
  }
}
