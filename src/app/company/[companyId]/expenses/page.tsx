import { notFound, redirect } from "next/navigation";
import { CompanyExpenseManager } from "@/components/company/company-expense-manager";
import { getSessionUserId } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export default async function CompanyExpenseManagerPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/login");
  }

  const { companyId } = await params;
  const company = await prisma.company.findFirst({
    where: { id: companyId, ownerId: userId },
    select: { id: true, name: true },
  });

  if (!company) {
    notFound();
  }

  return <CompanyExpenseManager companyId={company.id} companyName={company.name} />;
}
