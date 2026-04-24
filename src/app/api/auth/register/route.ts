import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validators/auth";
import { validationError } from "@/lib/api";

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const parsed = registerSchema.safeParse(payload);
    if (!parsed.success) {
      return validationError(parsed.error.issues[0]?.message ?? "Invalid registration payload.");
    }

    const email = parsed.data.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { ok: false, error: { code: "EMAIL_EXISTS", message: "Email already registered." } },
        { status: 409 }
      );
    }

    const passwordHash = await hash(parsed.data.password, 12);
    const user = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email,
        passwordHash,
      },
      select: { id: true, email: true, name: true },
    });

    return NextResponse.json({ ok: true, data: user }, { status: 201 });
  } catch (error) {
    console.error("register_error", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return NextResponse.json(
          { ok: false, error: { code: "EMAIL_EXISTS", message: "Email already registered." } },
          { status: 409 }
        );
      }

      if (error.code === "P2021") {
        return NextResponse.json(
          {
            ok: false,
            error: {
              code: "DB_SCHEMA_MISMATCH",
              message: "Database schema is not ready. Please run migrations.",
            },
          },
          { status: 500 }
        );
      }
    }

    if (error instanceof Prisma.PrismaClientInitializationError) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "DB_CONNECTION_ERROR",
            message: "Cannot connect to database. Please check server configuration.",
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: "Unexpected server error." } },
      { status: 500 }
    );
  }
}
