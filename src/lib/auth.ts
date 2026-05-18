import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";

export function readHasCompanyMode(user: unknown) {
  if (!user || typeof user !== "object" || !("hasCompanyMode" in user)) {
    return false;
  }

  return Boolean(user.hasCompanyMode);
}

export async function getHasCompanyMode(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { premiumUnlock: { select: { id: true } } },
  });

  return Boolean(user?.premiumUnlock);
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Email and Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password;
        if (!email || !password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            passwordHash: true,
            premiumUnlock: {
              select: { id: true },
            },
          },
        });
        if (!user) {
          return null;
        }

        const matches = await compare(password, user.passwordHash);
        if (!matches) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          hasCompanyMode: Boolean(user.premiumUnlock),
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.hasCompanyMode = readHasCompanyMode(user);
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        session.user.hasCompanyMode = Boolean(token.hasCompanyMode);
      }
      return session;
    },
  },
};
