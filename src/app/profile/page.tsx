import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/profile/profile-form";
import { getSessionUserId } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export default async function ProfilePage() {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, avatarColor: true },
  });
  if (!user) {
    redirect("/login");
  }

  return (
    <main className="container mx-auto flex-1 px-4 py-8 md:py-12">
      <ProfileForm profile={{ ...user, avatarColor: user.avatarColor ?? "#E76F51" }} />
    </main>
  );
}
