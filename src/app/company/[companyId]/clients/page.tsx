import { notFound, redirect } from "next/navigation";
import { ClientTable } from "@/components/company/client-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSessionUserId } from "@/lib/api";
import { listClientsForUser } from "@/lib/company-client-service";

export default async function CompanyClientsPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/login");
  }

  const { companyId } = await params;
  const result = await listClientsForUser({ userId, companyId });
  if ("error" in result) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <Card className="border-border bg-card text-card-foreground">
        <CardHeader>
          <Badge variant="outline" className="w-fit border-border bg-muted text-muted-foreground">
            Client master data
          </Badge>
          <CardTitle className="text-3xl text-card-foreground">Client</CardTitle>
          <CardDescription className="max-w-2xl text-muted-foreground">
            Manage company clients once, then select them when creating leads.
          </CardDescription>
        </CardHeader>
      </Card>

      <ClientTable companyId={companyId} clients={result.data} />
    </div>
  );
}
