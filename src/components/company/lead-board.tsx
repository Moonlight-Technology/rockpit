"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type LeadBoardProps = {
  companyId: string;
  canManage: boolean;
  collaboratorCount: number;
  columns: Array<{
    id: string;
    title: string;
    totalEstimatedValue: number;
    leads: Array<{
      id: string;
      title: string;
      prospectName: string;
      estimatedValue: number;
      stage: string;
    }>;
  }>;
};

const initialLeadForm = {
  title: "",
  prospectName: "",
  estimatedValue: "",
  notes: "",
  columnId: "",
};

export function LeadBoard({
  companyId,
  canManage,
  collaboratorCount,
  columns,
}: LeadBoardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [leadForm, setLeadForm] = useState(() => ({
    ...initialLeadForm,
    columnId: columns[0]?.id ?? "",
  }));
  const [inviteEmail, setInviteEmail] = useState("");
  const [leadError, setLeadError] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [leadSuccess, setLeadSuccess] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const normalizedEstimatedValue = Number(leadForm.estimatedValue);
  const isLeadFormValid =
    leadForm.title.trim().length > 0 &&
    leadForm.prospectName.trim().length > 0 &&
    Number.isFinite(normalizedEstimatedValue) &&
    normalizedEstimatedValue > 0 &&
    leadForm.columnId.length > 0;

  async function handleCreateLead(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLeadError(null);
    setLeadSuccess(null);

    if (!isLeadFormValid) {
      setLeadError("Fill in the required lead fields before creating a new lead.");
      return;
    }

    const response = await fetch(`/api/companies/${companyId}/leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...leadForm,
        estimatedValue: normalizedEstimatedValue,
      }),
    });
    const result = await response.json().catch(() => null);

    if (!response.ok || !result?.ok) {
      setLeadError(result?.error?.message ?? "Unable to create lead.");
      return;
    }

    setLeadForm({
      ...initialLeadForm,
      columnId: columns[0]?.id ?? "",
    });
    setLeadSuccess("Lead created.");
    startTransition(() => router.refresh());
  }

  async function handleInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInviteError(null);
    setInviteSuccess(null);

    const response = await fetch(`/api/companies/${companyId}/lead-members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail }),
    });
    const result = await response.json().catch(() => null);

    if (!response.ok || !result?.ok) {
      setInviteError(result?.error?.message ?? "Unable to invite collaborator.");
      return;
    }

    setInviteEmail("");
    setInviteSuccess("Collaborator invited.");
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.9fr)]">
        {canManage ? (
          <Card className="border-white/10 bg-[#181818] text-zinc-100">
            <CardHeader>
              <CardTitle className="text-base text-white">Create lead</CardTitle>
              <CardDescription className="text-zinc-400">
                Add a prospect directly into the pipeline.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={handleCreateLead}
                autoComplete="off"
                className="grid gap-3 md:grid-cols-2"
              >
              <label className="grid gap-1 text-sm">
                <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Title</span>
                <Input
                  name="companyLeadTitle"
                  value={leadForm.title}
                  onChange={(event) =>
                    setLeadForm((current) => ({ ...current, title: event.target.value }))
                  }
                  autoComplete="off"
                  className="border-white/10 bg-[#202020] text-white"
                  placeholder="Website redesign"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  Prospect
                </span>
                <Input
                  name="companyLeadProspect"
                  value={leadForm.prospectName}
                  onChange={(event) =>
                    setLeadForm((current) => ({ ...current, prospectName: event.target.value }))
                  }
                  autoComplete="off"
                  className="border-white/10 bg-[#202020] text-white"
                  placeholder="PT Nusantara"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  Estimated value
                </span>
                <Input
                  name="companyLeadEstimatedValue"
                  value={leadForm.estimatedValue}
                  onChange={(event) =>
                    setLeadForm((current) => ({
                      ...current,
                      estimatedValue: event.target.value,
                    }))
                  }
                  inputMode="numeric"
                  autoComplete="off"
                  className="border-white/10 bg-[#202020] text-white"
                  placeholder="5000000"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Stage</span>
                <select
                  value={leadForm.columnId}
                  onChange={(event) =>
                    setLeadForm((current) => ({ ...current, columnId: event.target.value }))
                  }
                  className="h-8 rounded-lg border border-white/10 bg-[#202020] px-3 text-white outline-none"
                >
                  {columns.map((column) => (
                    <option key={column.id} value={column.id}>
                      {column.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm md:col-span-2">
                <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Notes</span>
                <textarea
                  name="companyLeadNotes"
                  value={leadForm.notes}
                  onChange={(event) =>
                    setLeadForm((current) => ({ ...current, notes: event.target.value }))
                  }
                  rows={3}
                  autoComplete="off"
                  className="rounded-xl border border-white/10 bg-[#202020] px-3 py-2 text-white outline-none"
                  placeholder="Initial context, scope, or next step"
                />
              </label>
                <div className="mt-2 flex flex-wrap items-center gap-3 md:col-span-2">
                  <Button
                    type="submit"
                    disabled={isPending || !isLeadFormValid}
                    className="rounded-full bg-[#f2f2f2] px-4 text-sm font-medium text-[#111] hover:bg-white"
                  >
                    Add lead
                  </Button>
                  {leadError ? <p className="text-sm text-rose-300">{leadError}</p> : null}
                  {leadSuccess ? <p className="text-sm text-emerald-300">{leadSuccess}</p> : null}
                </div>
              </form>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-white/10 bg-[#181818] text-zinc-100">
            <CardHeader>
              <CardTitle className="text-base text-white">Collaborator access</CardTitle>
              <CardDescription className="text-zinc-400">
                You can review the pipeline and coordinate with the owner from this shared board.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        <Card className="border-white/10 bg-[#181818] text-zinc-100">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base text-white">Collaborators</CardTitle>
                <CardDescription className="text-zinc-400">
                  {collaboratorCount} active participant{collaboratorCount === 1 ? "" : "s"} on
                  this board.
                </CardDescription>
              </div>
              <Badge variant="outline" className="border-white/10 bg-[#202020] text-zinc-400">
                Shared board
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite}>
              {canManage ? (
                <>
                  <label className="grid gap-1 text-sm">
                <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Email</span>
                    <Input
                      type="email"
                      value={inviteEmail}
                      onChange={(event) => setInviteEmail(event.target.value)}
                      className="border-white/10 bg-[#202020] text-white"
                      placeholder="collaborator@example.com"
                    />
                  </label>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <Button
                      type="submit"
                      disabled={isPending}
                      variant="outline"
                      className="rounded-full border-white/15 bg-[#1f1f1f] px-4 text-white hover:bg-[#252525]"
                    >
                      Invite collaborator
                    </Button>
                    {inviteError ? <p className="text-sm text-rose-300">{inviteError}</p> : null}
                    {inviteSuccess ? (
                      <p className="text-sm text-emerald-300">{inviteSuccess}</p>
                    ) : null}
                  </div>
                </>
              ) : (
                <p className="text-sm text-zinc-400">
                  Only the company owner can add or change collaborator access for this board.
                </p>
              )}
            </form>
          </CardContent>
        </Card>
      </section>

      <div className="grid gap-4 xl:grid-cols-3 2xl:grid-cols-6">
        {columns.map((column) => (
          <Card
            key={column.id}
            className="border-white/10 bg-[#181818] text-zinc-100"
          >
            <CardHeader className="border-b border-white/10">
              <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-sm text-white">{column.title}</CardTitle>
                <CardDescription className="mt-1 text-xs text-zinc-500">
                  {column.leads.length} lead{column.leads.length === 1 ? "" : "s"}
                </CardDescription>
              </div>
              <span className="text-xs text-zinc-300">
                Rp{column.totalEstimatedValue.toLocaleString("id-ID")}
              </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {column.leads.map((lead) => (
                <article
                  key={lead.id}
                  className="rounded-xl border border-white/10 bg-[#202020] p-3 shadow-none"
                >
                  <p className="text-sm font-medium text-white">{lead.title}</p>
                  <p className="mt-1 text-xs text-zinc-400">{lead.prospectName}</p>
                  <div className="mt-3 flex items-center justify-between gap-2 text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                    <span>{lead.stage}</span>
                    <span>Rp{lead.estimatedValue.toLocaleString("id-ID")}</span>
                  </div>
                </article>
              ))}
              {column.leads.length === 0 ? (
                <p className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-xs text-zinc-500">
                  No leads in this stage yet.
                </p>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
