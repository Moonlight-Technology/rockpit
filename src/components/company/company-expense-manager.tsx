"use client";

import { Banknote } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type CompanyExpenseManagerProps = {
  companyId: string;
  companyName: string;
};

export function CompanyExpenseManager({
  companyId,
  companyName,
}: CompanyExpenseManagerProps) {
  return (
    <div className="space-y-6">
      <Card className="border-border bg-card text-card-foreground shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Banknote className="size-5" />
            Expense Manager
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Company expense workspace for {companyName}.</p>
          <p className="text-xs">Company ID: {companyId}</p>
        </CardContent>
      </Card>
    </div>
  );
}
