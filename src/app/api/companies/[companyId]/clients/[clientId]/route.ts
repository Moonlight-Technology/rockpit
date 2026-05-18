import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { deleteClientForUser, updateClientForUser } from "@/lib/company-client-service";
import { forbidden, getSessionUserId, notFound, unauthorized, validationError } from "@/lib/api";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ companyId: string; clientId: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return unauthorized();
  }

  const { companyId, clientId } = await params;

  try {
    const payload = await req.json().catch(() => null);
    if (payload === null) {
      return validationError("Invalid JSON payload.");
    }

    const result = await updateClientForUser({ userId, companyId, clientId, payload });
    if ("error" in result) {
      if (result.error === "FORBIDDEN") {
        return forbidden("Only company owner can manage clients.");
      }
      return notFound("Client not found.");
    }

    return NextResponse.json({ ok: true, data: result.data });
  } catch (error) {
    if (error instanceof ZodError) {
      return validationError(error.issues[0]?.message ?? "Invalid client payload.");
    }

    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: "Unexpected server error." } },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ companyId: string; clientId: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return unauthorized();
  }

  const { companyId, clientId } = await params;
  const result = await deleteClientForUser({ userId, companyId, clientId });
  if ("error" in result) {
    if (result.error === "FORBIDDEN") {
      return forbidden("Only company owner can manage clients.");
    }
    if (result.error === "CLIENT_IN_USE") {
      return validationError("Client is already used by a lead.");
    }
    return notFound("Client not found.");
  }

  return NextResponse.json({ ok: true, data: result.data });
}
