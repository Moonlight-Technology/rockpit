"use client";

import { useRouter } from "next/navigation";
import { Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type CompanyClientRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  companyName: string;
  address: string;
  notes: string;
  updatedAt: string | Date;
};

type ClientTableProps = {
  companyId: string;
  clients: CompanyClientRow[];
};

type ClientFormState = {
  name: string;
  email: string;
  phone: string;
  companyName: string;
  address: string;
  notes: string;
};

const emptyForm: ClientFormState = {
  name: "",
  email: "",
  phone: "",
  companyName: "",
  address: "",
  notes: "",
};

function toFormState(client: CompanyClientRow): ClientFormState {
  return {
    name: client.name,
    email: client.email,
    phone: client.phone,
    companyName: client.companyName,
    address: client.address,
    notes: client.notes,
  };
}

function formatDate(value: string | Date) {
  return new Date(value).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function ClientTable({ companyId, clients }: ClientTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<ClientFormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ClientFormState>(emptyForm);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isCreateValid = form.name.trim().length >= 2;
  const isEditValid = editForm.name.trim().length >= 2;

  function updateForm(field: keyof ClientFormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateEditForm(field: keyof ClientFormState, value: string) {
    setEditForm((current) => ({ ...current, [field]: value }));
  }

  async function submitJson(url: string, method: "POST" | "PATCH" | "DELETE", body?: object) {
    const response = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const result = await response.json().catch(() => null);

    if (!response.ok || !result?.ok) {
      throw new Error(result?.error?.message ?? "Unable to save client.");
    }
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!isCreateValid) {
      setError("Client name is required.");
      return;
    }

    try {
      await submitJson(`/api/companies/${companyId}/clients`, "POST", form);
      setForm(emptyForm);
      setMessage("Client created.");
      startTransition(() => router.refresh());
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to create client.");
    }
  }

  async function handleUpdate(clientId: string) {
    setError(null);
    setMessage(null);

    if (!isEditValid) {
      setError("Client name is required.");
      return;
    }

    try {
      await submitJson(`/api/companies/${companyId}/clients/${clientId}`, "PATCH", editForm);
      setEditingId(null);
      setMessage("Client updated.");
      startTransition(() => router.refresh());
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to update client.");
    }
  }

  async function handleDelete(clientId: string) {
    setError(null);
    setMessage(null);

    try {
      await submitJson(`/api/companies/${companyId}/clients/${clientId}`, "DELETE");
      setMessage("Client deleted.");
      startTransition(() => router.refresh());
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to delete client.");
    }
  }

  return (
    <div className="space-y-4">
      <Card className="border-border bg-card text-card-foreground">
        <CardHeader>
          <CardTitle className="text-base text-card-foreground">Create client</CardTitle>
          <CardDescription className="text-muted-foreground">
            Add the client once, then reuse it when creating leads.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="grid gap-3 lg:grid-cols-3">
            <Input
              value={form.name}
              onChange={(event) => updateForm("name", event.target.value)}
              placeholder="Client name"
              className="border-border bg-background text-foreground"
            />
            <Input
              value={form.companyName}
              onChange={(event) => updateForm("companyName", event.target.value)}
              placeholder="Company"
              className="border-border bg-background text-foreground"
            />
            <Input
              value={form.email}
              onChange={(event) => updateForm("email", event.target.value)}
              placeholder="Email"
              className="border-border bg-background text-foreground"
            />
            <Input
              value={form.phone}
              onChange={(event) => updateForm("phone", event.target.value)}
              placeholder="Phone"
              className="border-border bg-background text-foreground"
            />
            <Input
              value={form.address}
              onChange={(event) => updateForm("address", event.target.value)}
              placeholder="Address"
              className="border-border bg-background text-foreground"
            />
            <Input
              value={form.notes}
              onChange={(event) => updateForm("notes", event.target.value)}
              placeholder="Notes"
              className="border-border bg-background text-foreground"
            />
            <div className="flex flex-wrap items-center gap-3 lg:col-span-3">
              <Button type="submit" disabled={isPending || !isCreateValid}>
                <Plus className="size-4" />
                Add client
              </Button>
              {error ? <p className="text-sm text-rose-300">{error}</p> : null}
              {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-border bg-card text-card-foreground">
        <CardHeader>
          <CardTitle className="text-base text-card-foreground">Client list</CardTitle>
          <CardDescription className="text-muted-foreground">
            {clients.length} client{clients.length === 1 ? "" : "s"} available for lead creation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {clients.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client) => {
                  const isEditing = editingId === client.id;

                  return (
                    <TableRow key={client.id}>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            value={editForm.name}
                            onChange={(event) => updateEditForm("name", event.target.value)}
                            className="border-border bg-background"
                          />
                        ) : (
                          <span className="font-medium">{client.name}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            value={editForm.companyName}
                            onChange={(event) => updateEditForm("companyName", event.target.value)}
                            className="border-border bg-background"
                          />
                        ) : (
                          client.companyName || "-"
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            value={editForm.email}
                            onChange={(event) => updateEditForm("email", event.target.value)}
                            className="border-border bg-background"
                          />
                        ) : (
                          client.email || "-"
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            value={editForm.phone}
                            onChange={(event) => updateEditForm("phone", event.target.value)}
                            className="border-border bg-background"
                          />
                        ) : (
                          client.phone || "-"
                        )}
                      </TableCell>
                      <TableCell className="max-w-[240px] truncate">
                        {isEditing ? (
                          <Input
                            value={editForm.notes}
                            onChange={(event) => updateEditForm("notes", event.target.value)}
                            className="border-border bg-background"
                          />
                        ) : (
                          client.notes || "-"
                        )}
                      </TableCell>
                      <TableCell>{formatDate(client.updatedAt)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          {isEditing ? (
                            <>
                              <Button
                                type="button"
                                size="icon"
                                disabled={isPending || !isEditValid}
                                onClick={() => handleUpdate(client.id)}
                              >
                                <Save className="size-4" />
                              </Button>
                              <Button
                                type="button"
                                size="icon"
                                variant="outline"
                                onClick={() => setEditingId(null)}
                              >
                                <X className="size-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                type="button"
                                size="icon"
                                variant="outline"
                                onClick={() => {
                                  setEditingId(client.id);
                                  setEditForm(toFormState(client));
                                }}
                              >
                                <Pencil className="size-4" />
                              </Button>
                              <Button
                                type="button"
                                size="icon"
                                variant="outline"
                                disabled={isPending}
                                onClick={() => handleDelete(client.id)}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="rounded-xl border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
              No clients yet. Add your first client before creating a lead.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
