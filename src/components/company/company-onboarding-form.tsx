"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { normalizeQuotationPrefix } from "@/lib/company-premium";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function CompanyOnboardingForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [quotationPrefix, setQuotationPrefix] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const normalizedPrefix = normalizeQuotationPrefix(quotationPrefix);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          quotationPrefix,
        }),
      });

      const result = (await response.json().catch(() => null)) as
        | { data?: { id?: string }; error?: { message?: string } }
        | null;

      if (!response.ok || !result?.data?.id) {
        setError(result?.error?.message ?? "Failed to create company.");
        return;
      }

      router.replace(`/company/${result.data.id}/settings`);
      router.refresh();
    } catch {
      setError("Failed to create company.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="border-border bg-card text-card-foreground">
      <CardHeader>
        <CardTitle>Create company workspace</CardTitle>
        <CardDescription className="text-muted-foreground">
          This creates the company profile and the default Sales Pipeline lead board.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-5" onSubmit={onSubmit}>
          <Field>
            <FieldLabel htmlFor="company-name">Company name</FieldLabel>
            <FieldContent>
              <Input
                id="company-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Mamat Metal Works"
                className="border-border bg-background text-foreground placeholder:text-muted-foreground"
              />
              <FieldDescription className="text-muted-foreground">
                This becomes the workspace label and base for the company slug.
              </FieldDescription>
            </FieldContent>
          </Field>

          <Field>
            <FieldLabel htmlFor="company-prefix">Quotation prefix</FieldLabel>
            <FieldContent>
              <Input
                id="company-prefix"
                value={quotationPrefix}
                onChange={(event) => setQuotationPrefix(event.target.value)}
                placeholder="MAMATQT"
                className="border-border bg-background text-foreground placeholder:text-muted-foreground"
              />
              <FieldDescription className="text-muted-foreground">
                Normalized preview: <span className="font-medium text-foreground">{normalizedPrefix || "N/A"}</span>
              </FieldDescription>
            </FieldContent>
          </Field>

          <Field>
            <FieldLabel htmlFor="company-description">Description</FieldLabel>
            <FieldContent>
              <textarea
                id="company-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={5}
                maxLength={500}
                placeholder="What kind of service work does this company handle?"
                className="min-h-28 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 placeholder:text-muted-foreground"
              />
              <FieldDescription className="text-muted-foreground">
                Optional context for future leads, quotations, and workspace switching.
              </FieldDescription>
            </FieldContent>
          </Field>

          {error ? (
            <p className="rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm text-red-100">
              {error}
            </p>
          ) : null}

          <Button type="submit" size="lg" disabled={isSubmitting}>
            {isSubmitting ? "Creating company..." : "Create company"}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="border-border bg-muted/40 text-sm text-muted-foreground">
        Business type is fixed to JASA for this release.
      </CardFooter>
    </Card>
  );
}
