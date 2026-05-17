import { NextResponse } from "next/server";
import { convertLeadToProjectForUser } from "@/lib/company-conversion-service";
import { forbidden, getSessionUserId, notFound, unauthorized } from "@/lib/api";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ companyId: string; leadId: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return unauthorized();
  }

  const { companyId, leadId } = await params;

  try {
    const result = await convertLeadToProjectForUser({ userId, companyId, leadId });
    if ("error" in result) {
      if (result.error === "FORBIDDEN") {
        return forbidden("Only company owner can convert leads into project boards.");
      }

      if (result.error === "INVALID_STAGE") {
        return NextResponse.json(
          {
            ok: false,
            error: {
              code: "LEAD_NOT_CONVERTIBLE",
              message: "Only won leads can be converted into project boards.",
            },
          },
          { status: 409 }
        );
      }

      if (result.error === "ALREADY_CONVERTED") {
        return NextResponse.json(
          {
            ok: false,
            error: {
              code: "ALREADY_CONVERTED",
              message: "This lead has already been converted into a project board.",
            },
          },
          { status: 409 }
        );
      }

      return notFound("Lead or company not found.");
    }

    return NextResponse.json({ ok: true, data: result.data }, { status: 201 });
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: "Unexpected server error." } },
      { status: 500 }
    );
  }
}
