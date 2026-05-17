"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

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

  async function handleCreateLead(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLeadError(null);
    setLeadSuccess(null);

    const response = await fetch(`/api/companies/${companyId}/leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...leadForm,
        estimatedValue: Number(leadForm.estimatedValue),
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
          <form
            onSubmit={handleCreateLead}
            className="rounded-2xl border border-white/10 bg-white/6 p-4 text-slate-100 ring-1 ring-white/5"
          >
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-white">Create lead</h2>
              <p className="mt-1 text-xs text-slate-400">
                Add a prospect directly into the pipeline.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1 text-sm">
                <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Title</span>
                <input
                  value={leadForm.title}
                  onChange={(event) =>
                    setLeadForm((current) => ({ ...current, title: event.target.value }))
                  }
                  className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white outline-none"
                  placeholder="Website redesign"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  Prospect
                </span>
                <input
                  value={leadForm.prospectName}
                  onChange={(event) =>
                    setLeadForm((current) => ({ ...current, prospectName: event.target.value }))
                  }
                  className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white outline-none"
                  placeholder="PT Nusantara"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  Estimated value
                </span>
                <input
                  value={leadForm.estimatedValue}
                  onChange={(event) =>
                    setLeadForm((current) => ({
                      ...current,
                      estimatedValue: event.target.value,
                    }))
                  }
                  inputMode="numeric"
                  className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white outline-none"
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
                  className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white outline-none"
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
                  value={leadForm.notes}
                  onChange={(event) =>
                    setLeadForm((current) => ({ ...current, notes: event.target.value }))
                  }
                  rows={3}
                  className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white outline-none"
                  placeholder="Initial context, scope, or next step"
                />
              </label>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={isPending}
                className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-200 disabled:opacity-60"
              >
                Add lead
              </button>
              {leadError ? <p className="text-sm text-rose-300">{leadError}</p> : null}
              {leadSuccess ? <p className="text-sm text-emerald-300">{leadSuccess}</p> : null}
            </div>
          </form>
        ) : (
          <section className="rounded-2xl border border-white/10 bg-white/6 p-4 text-slate-100 ring-1 ring-white/5">
            <h2 className="text-sm font-semibold text-white">Collaborator access</h2>
            <p className="mt-2 text-sm text-slate-300">
              You can review the pipeline and coordinate with the owner from this shared board.
            </p>
          </section>
        )}

        <form
          onSubmit={handleInvite}
          className="rounded-2xl border border-white/10 bg-white/6 p-4 text-slate-100 ring-1 ring-white/5"
        >
          <h2 className="text-sm font-semibold text-white">Collaborators</h2>
          <p className="mt-1 text-xs text-slate-400">
            {collaboratorCount} active participant{collaboratorCount === 1 ? "" : "s"} on this
            board.
          </p>
          {canManage ? (
            <>
              <label className="mt-4 grid gap-1 text-sm">
                <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Email</span>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white outline-none"
                  placeholder="collaborator@example.com"
                />
              </label>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-white transition hover:border-white/30 hover:bg-white/10 disabled:opacity-60"
                >
                  Invite collaborator
                </button>
                {inviteError ? <p className="text-sm text-rose-300">{inviteError}</p> : null}
                {inviteSuccess ? <p className="text-sm text-emerald-300">{inviteSuccess}</p> : null}
              </div>
            </>
          ) : (
            <p className="mt-4 text-sm text-slate-300">
              Only the company owner can add or change collaborator access for this board.
            </p>
          )}
        </form>
      </section>

      <div className="grid gap-4 xl:grid-cols-3 2xl:grid-cols-6">
        {columns.map((column) => (
          <section
            key={column.id}
            className="rounded-2xl border border-white/10 bg-white/6 p-4 text-slate-100 ring-1 ring-white/5"
          >
            <header className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-white">{column.title}</h2>
                <p className="mt-1 text-xs text-slate-400">
                  {column.leads.length} lead{column.leads.length === 1 ? "" : "s"}
                </p>
              </div>
              <span className="text-xs text-cyan-100">
                Rp{column.totalEstimatedValue.toLocaleString("id-ID")}
              </span>
            </header>
            <div className="space-y-3">
              {column.leads.map((lead) => (
                <article
                  key={lead.id}
                  className="rounded-xl border border-white/10 bg-black/20 p-3 shadow-sm"
                >
                  <p className="text-sm font-medium text-white">{lead.title}</p>
                  <p className="mt-1 text-xs text-slate-400">{lead.prospectName}</p>
                  <div className="mt-3 flex items-center justify-between gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                    <span>{lead.stage}</span>
                    <span>Rp{lead.estimatedValue.toLocaleString("id-ID")}</span>
                  </div>
                </article>
              ))}
              {column.leads.length === 0 ? (
                <p className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-xs text-slate-500">
                  No leads in this stage yet.
                </p>
              ) : null}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
