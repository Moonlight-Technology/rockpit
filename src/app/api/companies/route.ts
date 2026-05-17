import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { forbidden, getSessionUserId, unauthorized, validationError } from "@/lib/api";
import { createCompanyForUser, listCompaniesForUser } from "@/lib/company-service";
import { prisma } from "@/lib/prisma";

async function hasCompanyMode(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { premiumUnlock: { select: { id: true } } },
  });

  return Boolean(user?.premiumUnlock);
}

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return unauthorized();
  }

  if (!(await hasCompanyMode(userId))) {
    return forbidden("Company mode is locked.");
  }

  const companies = await listCompaniesForUser(userId);

  return NextResponse.json({
    ok: true,
    data: companies,
    meta: { hasCompanyMode: true },
  });
}

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return unauthorized();
  }

  if (!(await hasCompanyMode(userId))) {
    return forbidden("Company mode is locked.");
  }

  try {
    const payload = await req.json();
    const company = await createCompanyForUser(userId, payload);
    return NextResponse.json({ ok: true, data: company }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return validationError(error.issues[0]?.message ?? "Invalid company payload.");
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return validationError("Company name or quotation prefix already exists.");
    }

    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: "Unexpected server error." } },
      { status: 500 }
    );
  }
}
