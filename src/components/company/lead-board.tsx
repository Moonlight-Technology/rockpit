"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type LeadCard = {
  id: string;
  title: string;
  prospectName: string;
  estimatedValue: number;
  stage: string;
  convertedProjectBoardId?: string | null;
};

type LeadColumn = {
  id: string;
  title: string;
  totalEstimatedValue: number;
  leads: LeadCard[];
};

type LeadBoardProps = {
  companyId: string;
  canManage: boolean;
  collaboratorCount: number;
  columns: LeadColumn[];
  clients: Array<{
    id: string;
    name: string;
    companyName: string;
    email: string;
  }>;
};

const LEAD_DRAG_MIME = "application/x-rockpit-lead";

function stageFromColumnTitle(title: string) {
  switch (title.trim().toLowerCase()) {
    case "new":
      return "NEW";
    case "qualified":
      return "QUALIFIED";
    case "proposal":
      return "PROPOSAL";
    case "negotiation":
      return "NEGOTIATION";
    case "won":
      return "WON";
    case "lost":
      return "LOST";
    default:
      return "NEW";
  }
}

function moveLeadBetweenColumns(
  columns: LeadColumn[],
  leadId: string,
  sourceColumnId: string,
  targetColumnId: string
): LeadColumn[] | null {
  if (sourceColumnId === targetColumnId) return null;
  const source = columns.find((column) => column.id === sourceColumnId);
  const target = columns.find((column) => column.id === targetColumnId);
  if (!source || !target) return null;
  const lead = source.leads.find((item) => item.id === leadId);
  if (!lead) return null;

  const movedLead: LeadCard = { ...lead, stage: stageFromColumnTitle(target.title) };

  return columns.map((column) => {
    if (column.id === sourceColumnId) {
      const leads = column.leads.filter((item) => item.id !== leadId);
      return {
        ...column,
        leads,
        totalEstimatedValue: leads.reduce((sum, item) => sum + item.estimatedValue, 0),
      };
    }
    if (column.id === targetColumnId) {
      const leads = [...column.leads, movedLead];
      return {
        ...column,
        leads,
        totalEstimatedValue: leads.reduce((sum, item) => sum + item.estimatedValue, 0),
      };
    }
    return column;
  });
}

const initialLeadForm = {
  title: "",
  clientId: "",
  estimatedValue: "",
  notes: "",
  columnId: "",
};

export function LeadBoard({
  companyId,
  canManage,
  collaboratorCount,
  columns,
  clients,
}: LeadBoardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [leadForm, setLeadForm] = useState(() => ({
    ...initialLeadForm,
    clientId: clients[0]?.id ?? "",
    columnId: columns[0]?.id ?? "",
  }));
  const [inviteEmail, setInviteEmail] = useState("");
  const [leadError, setLeadError] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [leadSuccess, setLeadSuccess] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [localColumns, setLocalColumns] = useState<LeadColumn[]>(columns);
  const [columnsSource, setColumnsSource] = useState(columns);
  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);

  if (columnsSource !== columns) {
    setColumnsSource(columns);
    setLocalColumns(columns);
  }
  const normalizedEstimatedValue = Number(leadForm.estimatedValue);
  const isLeadFormValid =
    leadForm.title.trim().length > 0 &&
    leadForm.clientId.length > 0 &&
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
      clientId: clients[0]?.id ?? "",
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

  async function moveLeadToColumn(
    leadId: string,
    sourceColumnId: string,
    targetColumnId: string
  ) {
    if (!canManage || sourceColumnId === targetColumnId) return;

    const snapshot = localColumns;
    const optimistic = moveLeadBetweenColumns(
      localColumns,
      leadId,
      sourceColumnId,
      targetColumnId
    );
    if (!optimistic) return;

    setLeadError(null);
    setLocalColumns(optimistic);

    try {
      const response = await fetch(
        `/api/companies/${companyId}/leads/${leadId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ columnId: targetColumnId }),
        }
      );
      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.ok) {
        setLocalColumns(snapshot);
        setLeadError(result?.error?.message ?? "Unable to move lead.");
        return;
      }

      startTransition(() => router.refresh());
    } catch {
      setLocalColumns(snapshot);
      setLeadError("Network error while moving lead.");
    }
  }

  function handleLeadDragStart(
    event: React.DragEvent<HTMLElement>,
    lead: LeadCard,
    columnId: string
  ) {
    if (!canManage) return;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(LEAD_DRAG_MIME, lead.id);
    event.dataTransfer.setData("text/source-column-id", columnId);
    setDraggingLeadId(lead.id);
  }

  function handleLeadDragEnd() {
    setDraggingLeadId(null);
    setDragOverColumnId(null);
  }

  function handleColumnDragOver(event: React.DragEvent<HTMLElement>, columnId: string) {
    if (!canManage || !draggingLeadId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (dragOverColumnId !== columnId) {
      setDragOverColumnId(columnId);
    }
  }

  function handleColumnDragLeave(columnId: string) {
    if (dragOverColumnId === columnId) {
      setDragOverColumnId(null);
    }
  }

  function handleColumnDrop(event: React.DragEvent<HTMLElement>, targetColumnId: string) {
    if (!canManage) return;
    event.preventDefault();
    const leadId = event.dataTransfer.getData(LEAD_DRAG_MIME);
    const sourceColumnId = event.dataTransfer.getData("text/source-column-id");
    setDraggingLeadId(null);
    setDragOverColumnId(null);
    if (!leadId || !sourceColumnId) return;
    void moveLeadToColumn(leadId, sourceColumnId, targetColumnId);
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.9fr)]">
        {canManage ? (
          <Card className="border-border bg-card text-card-foreground">
            <CardHeader>
              <CardTitle className="text-base text-card-foreground">Create lead</CardTitle>
              <CardDescription className="text-muted-foreground">
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
                  className="border-border bg-background text-foreground"
                  placeholder="Website redesign"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Client</span>
                <select
                  value={leadForm.clientId}
                  onChange={(event) =>
                    setLeadForm((current) => ({ ...current, clientId: event.target.value }))
                  }
                  className="h-8 rounded-lg border border-border bg-background px-3 text-foreground outline-none"
                  disabled={clients.length === 0}
                >
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.companyName ? `${client.name} - ${client.companyName}` : client.name}
                    </option>
                  ))}
                </select>
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
                  className="border-border bg-background text-foreground"
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
                  className="h-8 rounded-lg border border-border bg-background px-3 text-foreground outline-none"
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
                  className="rounded-xl border border-border bg-background px-3 py-2 text-foreground outline-none"
                  placeholder="Initial context, scope, or next step"
                />
              </label>
                <div className="mt-2 flex flex-wrap items-center gap-3 md:col-span-2">
                  {clients.length === 0 ? (
                    <p className="basis-full text-sm text-muted-foreground">
                      Create a client first before adding a lead.
                    </p>
                  ) : null}
                  <Button
                    type="submit"
                    disabled={isPending || !isLeadFormValid}
                    className="rounded-full px-4 text-sm font-medium"
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
          <Card className="border-border bg-card text-card-foreground">
            <CardHeader>
              <CardTitle className="text-base text-card-foreground">Collaborator access</CardTitle>
              <CardDescription className="text-muted-foreground">
                You can review the pipeline and coordinate with the owner from this shared board.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        <Card className="border-border bg-card text-card-foreground">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base text-card-foreground">Collaborators</CardTitle>
                <CardDescription className="text-muted-foreground">
                  {collaboratorCount} active participant{collaboratorCount === 1 ? "" : "s"} on
                  this board.
                </CardDescription>
              </div>
              <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
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
                      className="border-border bg-background text-foreground"
                      placeholder="collaborator@example.com"
                    />
                  </label>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <Button
                      type="submit"
                      disabled={isPending}
                      variant="outline"
                      className="rounded-full border-border bg-background px-4 text-foreground hover:bg-accent"
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
                <p className="text-sm text-muted-foreground">
                  Only the company owner can add or change collaborator access for this board.
                </p>
              )}
            </form>
          </CardContent>
        </Card>
      </section>

      {leadError ? (
        <p className="text-sm text-rose-300" role="alert">
          {leadError}
        </p>
      ) : null}
      <div className="grid gap-4 xl:grid-cols-3 2xl:grid-cols-6">
        {localColumns.map((column) => {
          const isDropTarget =
            canManage && draggingLeadId !== null && dragOverColumnId === column.id;
          return (
            <Card
              key={column.id}
              className={`border-border bg-card text-card-foreground transition ${
                isDropTarget ? "ring-2 ring-primary/40" : ""
              }`}
              onDragOver={(event) => handleColumnDragOver(event, column.id)}
              onDragLeave={() => handleColumnDragLeave(column.id)}
              onDrop={(event) => handleColumnDrop(event, column.id)}
            >
              <CardHeader className="border-b border-border">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-sm text-card-foreground">{column.title}</CardTitle>
                    <CardDescription className="mt-1 text-xs text-muted-foreground">
                      {column.leads.length} lead{column.leads.length === 1 ? "" : "s"}
                    </CardDescription>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Rp{column.totalEstimatedValue.toLocaleString("id-ID")}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {column.leads.map((lead) => {
                  const isLocked = Boolean(lead.convertedProjectBoardId);
                  const isDraggable = canManage && !isLocked;
                  const isDragging = draggingLeadId === lead.id;
                  return (
                    <article
                      key={lead.id}
                      draggable={isDraggable}
                      onDragStart={(event) => handleLeadDragStart(event, lead, column.id)}
                      onDragEnd={handleLeadDragEnd}
                      className={`rounded-xl border border-border bg-muted/40 p-3 shadow-none ${
                        isDraggable ? "cursor-grab active:cursor-grabbing" : ""
                      } ${isDragging ? "opacity-60" : ""}`}
                    >
                      <p className="text-sm font-medium text-card-foreground">{lead.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{lead.prospectName}</p>
                      <div className="mt-3 flex items-center justify-between gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                        <span>{lead.stage}</span>
                        <span>Rp{lead.estimatedValue.toLocaleString("id-ID")}</span>
                      </div>
                    </article>
                  );
                })}
                {column.leads.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border px-3 py-4 text-xs text-muted-foreground">
                    No leads in this stage yet.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
