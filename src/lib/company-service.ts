import { createCompanySchema } from "@/lib/validators/company";
import { prisma } from "@/lib/prisma";

export async function listCompaniesForUser(userId: string) {
  return prisma.company.findMany({
    where: { ownerId: userId },
    select: { id: true, name: true, slug: true, quotationPrefix: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function getCompanyForUser(userId: string, companyId: string) {
  return prisma.company.findFirst({
    where: { id: companyId, ownerId: userId },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      businessType: true,
      quotationPrefix: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function createCompanyForUser(userId: string, input: unknown) {
  const parsed = createCompanySchema.parse(input);
  const slug = parsed.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");

  return prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: {
        ownerId: userId,
        name: parsed.name,
        slug,
        description: parsed.description,
        businessType: parsed.businessType,
        quotationPrefix: parsed.quotationPrefix,
      },
    });

    const leadBoard = await tx.companyLeadBoard.create({
      data: {
        companyId: company.id,
        name: "Sales Pipeline",
        description: "Default lead board",
      },
    });

    await tx.companyLeadColumn.createMany({
      data: ["New", "Qualified", "Proposal", "Negotiation", "Won", "Lost"].map(
        (title, index) => ({
          leadBoardId: leadBoard.id,
          title,
          position: index,
        })
      ),
    });

    return company;
  });
}
