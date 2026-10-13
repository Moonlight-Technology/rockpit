import { prisma } from "@/lib/prisma";
import { updateProfileSchema } from "@/lib/validators/profile";

type Profile = {
  id: string;
  name: string;
  email: string;
  avatarColor: string | null;
};

type ProfileDeps = {
  prisma: {
    user: {
      update: (args: unknown) => Promise<Profile>;
    };
  };
};

const defaultDeps: ProfileDeps = { prisma: prisma as unknown as ProfileDeps["prisma"] };

export async function updateProfileWithDependencies(
  input: { userId: string; payload: unknown },
  deps: ProfileDeps
) {
  const profile = updateProfileSchema.parse(input.payload);
  const user = await deps.prisma.user.update({
    where: { id: input.userId },
    data: profile,
    select: { id: true, name: true, email: true, avatarColor: true },
  });

  return { data: user };
}

export function updateProfileForUser(input: { userId: string; payload: unknown }) {
  return updateProfileWithDependencies(input, defaultDeps);
}
