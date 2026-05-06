"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Banknote,
  Landmark,
  Plus,
  ReceiptText,
  Repeat,
  WalletCards,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type MoneyAccountType = "CASH" | "BANK" | "EWALLET" | "OTHER";
type CategoryKind = "INCOME" | "EXPENSE" | "BOTH";
type TransactionType = "INCOME" | "EXPENSE" | "TRANSFER" | "LEND" | "RECEIVABLE_PAYMENT";
type WishlistPriority = "LOW" | "MEDIUM" | "HIGH";
type WishlistStatus = "PLANNED" | "BOUGHT" | "SKIPPED";
type ReceivableStatus = "ACTIVE" | "PAID";
type ActiveForm = "INCOME" | "EXPENSE" | "TRANSFER" | "LEND" | null;

type MoneyAccount = {
  id: string;
  name: string;
  type: MoneyAccountType;
  balance: number;
  createdAt: string;
  updatedAt: string;
};

type MoneyCategory = {
  id: string;
  name: string;
  kind: CategoryKind;
  isDefault: boolean;
  isActive: boolean;
};

type MoneyTransaction = {
  id: string;
  type: TransactionType;
  amount: number;
  description: string | null;
  occurredAt: string;
  category: { id: string; name: string } | null;
  account: { id: string; name: string } | null;
  fromAccount: { id: string; name: string } | null;
  toAccount: { id: string; name: string } | null;
  receivable: { id: string; personName: string } | null;
};

type MoneyBudget = {
  id: string;
  month: string;
  totalAmount: number;
  buckets: Array<{
    id: string;
    label: string;
    percentage: number;
    allocatedAmount: number;
    usedAmount: number;
    remainingAmount: number;
    categories: Array<{ id: string; name: string }>;
  }>;
};

type WishlistItem = {
  id: string;
  name: string;
  estimatedPrice: number;
  priority: WishlistPriority;
  status: WishlistStatus;
  notes: string | null;
};

type Receivable = {
  id: string;
  personName: string;
  originalAmount: number;
  remainingAmount: number;
  status: ReceivableStatus;
  dueDate: string | null;
  notes: string | null;
  payments: Array<{
    id: string;
    amount: number;
    paidAt: string;
  }>;
};

type BudgetDraftBucket = {
  id?: string;
  label: string;
  percentage: number;
  categoryIds: string[];
};

const accountTypes: MoneyAccountType[] = ["CASH", "BANK", "EWALLET", "OTHER"];
const categoryKinds: CategoryKind[] = ["EXPENSE", "INCOME", "BOTH"];
const wishlistPriorities: WishlistPriority[] = ["LOW", "MEDIUM", "HIGH"];

const formatRupiah = (amount: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);

const currentMonthValue = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

const todayDateValue = () => new Date().toISOString().slice(0, 10);

async function readApi<T>(url: string): Promise<T | null> {
  const response = await fetch(url, { cache: "no-store" });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.ok) return null;
  return result.data as T;
}

async function postApi(url: string, payload: unknown) {
  return writeApi(url, "POST", payload);
}

async function patchApi(url: string, payload: unknown) {
  return writeApi(url, "PATCH", payload);
}

async function writeApi(url: string, method: "POST" | "PATCH", payload: unknown) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.ok) {
    throw new Error(result?.error?.message ?? "Gagal menyimpan data.");
  }
  return result.data;
}

function toIsoDate(date: string) {
  return new Date(`${date || todayDateValue()}T12:00:00`).toISOString();
}

function transactionLabel(transaction: MoneyTransaction) {
  if (transaction.type === "TRANSFER") {
    return `${transaction.fromAccount?.name ?? "Akun"} ke ${transaction.toAccount?.name ?? "Akun"}`;
  }
  if (transaction.type === "LEND") {
    return `Piutang ${transaction.receivable?.personName ?? transaction.description ?? ""}`.trim();
  }
  if (transaction.type === "RECEIVABLE_PAYMENT") {
    return `Bayar piutang ${transaction.receivable?.personName ?? ""}`.trim();
  }
  return transaction.category?.name ?? transaction.description ?? transaction.type;
}

function transactionSign(transaction: MoneyTransaction) {
  if (transaction.type === "INCOME" || transaction.type === "RECEIVABLE_PAYMENT") return "+";
  if (transaction.type === "EXPENSE" || transaction.type === "LEND") return "-";
  return "";
}

function budgetToDraft(budget: MoneyBudget) {
  return {
    totalAmount: String(budget.totalAmount),
    buckets: budget.buckets.map((bucket) => ({
      id: bucket.id,
      label: bucket.label,
      percentage: bucket.percentage,
      categoryIds: bucket.categories.map((category) => category.id),
    })),
  };
}

export default function MoneyManagerPage() {
  const router = useRouter();
  const [month, setMonth] = useState(currentMonthValue);
  const [accounts, setAccounts] = useState<MoneyAccount[]>([]);
  const [categories, setCategories] = useState<MoneyCategory[]>([]);
  const [transactions, setTransactions] = useState<MoneyTransaction[]>([]);
  const [budget, setBudget] = useState<MoneyBudget | null>(null);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fabOpen, setFabOpen] = useState(false);
  const [activeForm, setActiveForm] = useState<ActiveForm>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [transactionForm, setTransactionForm] = useState({
    amount: "",
    accountId: "",
    categoryId: "",
    fromAccountId: "",
    toAccountId: "",
    personName: "",
    dueDate: "",
    description: "",
    occurredAt: todayDateValue(),
  });
  const [accountForm, setAccountForm] = useState<{ name: string; type: MoneyAccountType }>({
    name: "",
    type: "CASH",
  });
  const [accountError, setAccountError] = useState<string | null>(null);
  const [categoryForm, setCategoryForm] = useState<{ id: string | null; name: string; kind: CategoryKind }>({
    id: null,
    name: "",
    kind: "EXPENSE",
  });
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [budgetDraft, setBudgetDraft] = useState<{ totalAmount: string; buckets: BudgetDraftBucket[] }>({
    totalAmount: "",
    buckets: [],
  });
  const [budgetError, setBudgetError] = useState<string | null>(null);
  const [wishlistForm, setWishlistForm] = useState({
    name: "",
    estimatedPrice: "",
    priority: "MEDIUM" as WishlistPriority,
    notes: "",
  });
  const [wishlistError, setWishlistError] = useState<string | null>(null);
  const [repaymentForms, setRepaymentForms] = useState<Record<string, { amount: string; accountId: string }>>({});
  const [repaymentError, setRepaymentError] = useState<string | null>(null);

  const expenseCategories = useMemo(
    () => categories.filter((category) => category.isActive && category.kind !== "INCOME"),
    [categories]
  );
  const incomeCategories = useMemo(
    () => categories.filter((category) => category.isActive && category.kind !== "EXPENSE"),
    [categories]
  );
  const totalBalance = useMemo(
    () => accounts.reduce((sum, account) => sum + account.balance, 0),
    [accounts]
  );

  const loadMoneyData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextAccounts, nextCategories, nextTransactions, nextBudget, nextWishlist, nextReceivables] =
        await Promise.all([
          readApi<MoneyAccount[]>("/api/money/accounts"),
          readApi<MoneyCategory[]>("/api/money/categories"),
          readApi<MoneyTransaction[]>(`/api/money/transactions?month=${month}`),
          readApi<MoneyBudget>(`/api/money/budgets?month=${month}`),
          readApi<WishlistItem[]>("/api/money/wishlist"),
          readApi<Receivable[]>("/api/money/receivables"),
        ]);

      setAccounts(nextAccounts ?? []);
      setCategories(nextCategories ?? []);
      setTransactions(nextTransactions ?? []);
      setBudget(nextBudget);
      setWishlist(nextWishlist ?? []);
      setReceivables(nextReceivables ?? []);
      if (nextBudget) {
        setBudgetDraft(budgetToDraft(nextBudget));
      }
      if (!nextAccounts || !nextCategories || !nextTransactions || !nextBudget || !nextWishlist || !nextReceivables) {
        setError("Sebagian data belum tersedia. Coba muat ulang setelah backend Money Manager aktif.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadMoneyData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const openTransactionForm = (type: Exclude<ActiveForm, null>) => {
    setActiveForm(type);
    setFabOpen(false);
    setFormError(null);
    setTransactionForm((prev) => ({
      ...prev,
      accountId: accounts[0]?.id ?? "",
      fromAccountId: accounts[0]?.id ?? "",
      toAccountId: accounts[1]?.id ?? accounts[0]?.id ?? "",
      categoryId: type === "EXPENSE" ? expenseCategories[0]?.id ?? "" : incomeCategories[0]?.id ?? "",
      occurredAt: todayDateValue(),
    }));
  };

  const submitTransaction = async (event: FormEvent) => {
    event.preventDefault();
    if (!activeForm) return;
    setFormError(null);
    const amount = Number(transactionForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError("Nominal harus lebih dari 0.");
      return;
    }
    if (activeForm === "EXPENSE" && !transactionForm.categoryId) {
      setFormError("Kategori wajib dipilih.");
      return;
    }

    const base = {
      type: activeForm,
      amount,
      description: transactionForm.description.trim() || null,
      occurredAt: toIsoDate(transactionForm.occurredAt),
    };
    const payload =
      activeForm === "INCOME"
        ? {
            ...base,
            accountId: transactionForm.accountId,
            categoryId: transactionForm.categoryId || null,
          }
        : activeForm === "EXPENSE"
          ? { ...base, accountId: transactionForm.accountId, categoryId: transactionForm.categoryId }
          : activeForm === "TRANSFER"
            ? { ...base, fromAccountId: transactionForm.fromAccountId, toAccountId: transactionForm.toAccountId }
            : {
                ...base,
                accountId: transactionForm.accountId,
                personName: transactionForm.personName.trim(),
                dueDate: transactionForm.dueDate ? toIsoDate(transactionForm.dueDate) : null,
              };

    if (activeForm === "LEND" && !transactionForm.personName.trim()) {
      setFormError("Nama peminjam wajib diisi.");
      return;
    }

    setSaving(true);
    try {
      await postApi("/api/money/transactions", payload);
      setActiveForm(null);
      setTransactionForm((prev) => ({ ...prev, amount: "", personName: "", description: "", dueDate: "" }));
      await loadMoneyData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Gagal menyimpan transaksi.");
    } finally {
      setSaving(false);
    }
  };

  const submitAccount = async (event: FormEvent) => {
    event.preventDefault();
    setAccountError(null);
    if (!accountForm.name.trim()) {
      setAccountError("Nama akun wajib diisi.");
      return;
    }
    try {
      await postApi("/api/money/accounts", { name: accountForm.name.trim(), type: accountForm.type });
      setAccountForm({ name: "", type: "CASH" });
      await loadMoneyData();
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : "Gagal membuat akun.");
    }
  };

  const submitBudget = async (event: FormEvent) => {
    event.preventDefault();
    setBudgetError(null);
    const percentageTotal = budgetDraft.buckets.reduce((sum, bucket) => sum + Number(bucket.percentage), 0);
    if (percentageTotal !== 100) {
      setBudgetError("Total persentase harus 100%.");
      return;
    }
    try {
      await postApi("/api/money/budgets", {
        month,
        totalAmount: Number(budgetDraft.totalAmount || 0),
        buckets: budgetDraft.buckets.map((bucket) => ({
          id: bucket.id,
          label: bucket.label,
          percentage: Number(bucket.percentage),
          categoryIds: bucket.categoryIds,
        })),
      });
      await loadMoneyData();
    } catch (err) {
      setBudgetError(err instanceof Error ? err.message : "Gagal menyimpan budget.");
    }
  };

  const submitCategory = async (event: FormEvent) => {
    event.preventDefault();
    setCategoryError(null);
    if (!categoryForm.name.trim()) {
      setCategoryError("Nama kategori wajib diisi.");
      return;
    }

    try {
      const payload = {
        name: categoryForm.name.trim(),
        kind: categoryForm.kind,
        ...(categoryForm.id ? { id: categoryForm.id } : {}),
      };
      if (categoryForm.id) {
        await patchApi("/api/money/categories", payload);
      } else {
        await postApi("/api/money/categories", payload);
      }
      setCategoryForm({ id: null, name: "", kind: "EXPENSE" });
      await loadMoneyData();
    } catch (err) {
      setCategoryError(err instanceof Error ? err.message : "Gagal menyimpan kategori.");
    }
  };

  const submitWishlist = async (event: FormEvent) => {
    event.preventDefault();
    setWishlistError(null);
    if (!wishlistForm.name.trim()) {
      setWishlistError("Nama wishlist wajib diisi.");
      return;
    }
    try {
      await postApi("/api/money/wishlist", {
        name: wishlistForm.name.trim(),
        estimatedPrice: Number(wishlistForm.estimatedPrice || 0),
        priority: wishlistForm.priority,
        notes: wishlistForm.notes.trim() || null,
      });
      setWishlistForm({ name: "", estimatedPrice: "", priority: "MEDIUM", notes: "" });
      await loadMoneyData();
    } catch (err) {
      setWishlistError(err instanceof Error ? err.message : "Gagal menyimpan wishlist.");
    }
  };

  const submitRepayment = async (receivable: Receivable) => {
    setRepaymentError(null);
    const form = repaymentForms[receivable.id] ?? { amount: "", accountId: accounts[0]?.id ?? "" };
    try {
      await postApi("/api/money/receivables", {
        receivableId: receivable.id,
        amount: Number(form.amount),
        accountId: form.accountId,
        paidAt: new Date().toISOString(),
        notes: null,
      });
      setRepaymentForms((prev) => ({ ...prev, [receivable.id]: { ...form, amount: "" } }));
      await loadMoneyData();
    } catch (err) {
      setRepaymentError(err instanceof Error ? err.message : "Gagal mencatat pembayaran.");
    }
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f9fafc_0%,#f3f5fa_48%,#eef2f9_100%)]">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-5 md:px-8 md:py-8">
        <header className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button size="icon" variant="outline" aria-label="Back to dashboard" onClick={() => router.push("/")}>
              <ArrowLeft />
            </Button>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Money Manager</h1>
              <p className="text-sm text-muted-foreground">Saldo {formatRupiah(totalBalance)}</p>
            </div>
          </div>
          <Input
            className="w-36 bg-background"
            type="month"
            aria-label="Budget month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
          />
        </header>

        {error ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{error}</div>
        ) : null}

        <section className="flex gap-3 overflow-x-auto pb-1">
          {accounts.length === 0 ? (
            <Card size="sm" className="min-w-64 border-dashed bg-white/70">
              <CardContent>
                <p className="font-medium">Belum ada akun</p>
                <p className="mt-1 text-sm text-muted-foreground">Tambah Cash, Bank, atau E-wallet dari tab Akun.</p>
              </CardContent>
            </Card>
          ) : (
            accounts.map((account) => (
              <Card key={account.id} size="sm" className="min-w-52 bg-white/80">
                <CardContent className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-slate-100">
                    {account.type === "CASH" ? <Banknote /> : <Landmark />}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{account.name}</p>
                    <p className="text-xs text-muted-foreground">{account.type}</p>
                    <p className="mt-1 font-semibold">{formatRupiah(account.balance)}</p>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </section>

        <Tabs defaultValue="transactions" className="gap-3">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="transactions">Transaksi</TabsTrigger>
            <TabsTrigger value="budget">Budget</TabsTrigger>
            <TabsTrigger value="wishlist">Wishlist</TabsTrigger>
            <TabsTrigger value="receivables">Piutang</TabsTrigger>
            <TabsTrigger value="accounts">Akun</TabsTrigger>
          </TabsList>

          <TabsContent value="transactions" className="space-y-3">
            {loading ? <p className="text-sm text-muted-foreground">Memuat transaksi...</p> : null}
            {transactions.length === 0 && !loading ? (
              <Card size="sm" className="bg-white/80">
                <CardContent className="text-sm text-muted-foreground">Belum ada transaksi bulan ini.</CardContent>
              </Card>
            ) : null}
            {transactions.map((transaction) => (
              <Card key={transaction.id} size="sm" className="bg-white/80">
                <CardContent className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-slate-100">
                      {transaction.type === "TRANSFER" ? <Repeat /> : <ReceiptText />}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{transactionLabel(transaction)}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(transaction.occurredAt).toLocaleDateString("id-ID")} ·{" "}
                        {transaction.account?.name ?? transaction.fromAccount?.name ?? transaction.toAccount?.name ?? "-"}
                      </p>
                    </div>
                  </div>
                  <p className="shrink-0 font-semibold">
                    {transactionSign(transaction)}
                    {formatRupiah(transaction.amount)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="budget" className="space-y-3">
            <form className="space-y-3" onSubmit={submitBudget}>
              <Card size="sm" className="bg-white/80">
                <CardHeader>
                  <CardTitle>Budget Bulanan</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="budget-total">Total budget</Label>
                    <Input
                      id="budget-total"
                      inputMode="numeric"
                      value={budgetDraft.totalAmount}
                      onChange={(event) => setBudgetDraft((prev) => ({ ...prev, totalAmount: event.target.value }))}
                    />
                  </div>
                  {budgetDraft.buckets.map((bucket, index) => {
                    const sourceBucket = budget?.buckets[index];
                    const usedPercent = sourceBucket?.allocatedAmount
                      ? Math.min(100, Math.round((sourceBucket.usedAmount / sourceBucket.allocatedAmount) * 100))
                      : 0;
                    return (
                      <div key={bucket.id ?? bucket.label} className="space-y-2 rounded-lg border bg-background/70 p-3">
                        <div className="grid grid-cols-[1fr_5rem] gap-2">
                          <Input
                            aria-label="Bucket label"
                            value={bucket.label}
                            onChange={(event) =>
                              setBudgetDraft((prev) => ({
                                ...prev,
                                buckets: prev.buckets.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, label: event.target.value } : item
                                ),
                              }))
                            }
                          />
                          <Input
                            aria-label="Bucket percentage"
                            inputMode="numeric"
                            value={bucket.percentage}
                            onChange={(event) =>
                              setBudgetDraft((prev) => ({
                                ...prev,
                                buckets: prev.buckets.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, percentage: Number(event.target.value) } : item
                                ),
                              }))
                            }
                          />
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{formatRupiah(sourceBucket?.usedAmount ?? 0)} terpakai</span>
                          <span>{formatRupiah(sourceBucket?.remainingAmount ?? 0)} sisa</span>
                        </div>
                        <Progress value={usedPercent} />
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {expenseCategories.map((category) => (
                            <label key={category.id} className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={bucket.categoryIds.includes(category.id)}
                                onChange={(event) =>
                                  setBudgetDraft((prev) => ({
                                    ...prev,
                                    buckets: prev.buckets.map((item, itemIndex) => {
                                      if (itemIndex !== index) return item;
                                      const nextIds = event.target.checked
                                        ? [...item.categoryIds, category.id]
                                        : item.categoryIds.filter((id) => id !== category.id);
                                      return { ...item, categoryIds: nextIds };
                                    }).map((item, itemIndex) =>
                                      event.target.checked && itemIndex !== index
                                        ? {
                                            ...item,
                                            categoryIds: item.categoryIds.filter((id) => id !== category.id),
                                          }
                                        : item
                                    ),
                                  }))
                                }
                              />
                              {category.name}
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {budgetError ? <p className="text-sm text-destructive">{budgetError}</p> : null}
                  <Button type="submit" className="w-full sm:w-auto">Simpan Budget</Button>
                </CardContent>
              </Card>
            </form>
            <Card size="sm" className="bg-white/80">
              <CardHeader>
                <CardTitle>Kategori</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <form className="grid gap-3 md:grid-cols-[1fr_10rem_auto]" onSubmit={submitCategory}>
                  <Input
                    placeholder="Nama kategori"
                    value={categoryForm.name}
                    onChange={(event) => setCategoryForm((prev) => ({ ...prev, name: event.target.value }))}
                  />
                  <select
                    className="h-8 rounded-lg border bg-background px-2 text-sm"
                    value={categoryForm.kind}
                    onChange={(event) =>
                      setCategoryForm((prev) => ({ ...prev, kind: event.target.value as CategoryKind }))
                    }
                  >
                    {categoryKinds.map((kind) => (
                      <option key={kind} value={kind}>{kind}</option>
                    ))}
                  </select>
                  <Button type="submit">{categoryForm.id ? "Simpan" : "Tambah"}</Button>
                  {categoryForm.id ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCategoryForm({ id: null, name: "", kind: "EXPENSE" })}
                    >
                      Batal
                    </Button>
                  ) : null}
                </form>
                {categoryError ? <p className="text-sm text-destructive">{categoryError}</p> : null}
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {categories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      className="rounded-lg border bg-background/70 px-3 py-2 text-left text-sm"
                      onClick={() =>
                        setCategoryForm({ id: category.id, name: category.name, kind: category.kind })
                      }
                    >
                      <span className="font-medium">{category.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{category.kind}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="wishlist" className="space-y-3">
            <Card size="sm" className="bg-white/80">
              <CardHeader>
                <CardTitle>Wishlist Reminder</CardTitle>
              </CardHeader>
              <CardContent>
                <form className="grid gap-3 md:grid-cols-[1fr_10rem_9rem_auto]" onSubmit={submitWishlist}>
                  <Input
                    placeholder="Nama barang"
                    value={wishlistForm.name}
                    onChange={(event) => setWishlistForm((prev) => ({ ...prev, name: event.target.value }))}
                  />
                  <Input
                    inputMode="numeric"
                    placeholder="Estimasi"
                    value={wishlistForm.estimatedPrice}
                    onChange={(event) => setWishlistForm((prev) => ({ ...prev, estimatedPrice: event.target.value }))}
                  />
                  <select
                    className="h-8 rounded-lg border bg-background px-2 text-sm"
                    value={wishlistForm.priority}
                    onChange={(event) =>
                      setWishlistForm((prev) => ({ ...prev, priority: event.target.value as WishlistPriority }))
                    }
                  >
                    {wishlistPriorities.map((priority) => (
                      <option key={priority} value={priority}>{priority}</option>
                    ))}
                  </select>
                  <Button type="submit">Tambah</Button>
                  <Input
                    className="md:col-span-4"
                    placeholder="Catatan opsional"
                    value={wishlistForm.notes}
                    onChange={(event) => setWishlistForm((prev) => ({ ...prev, notes: event.target.value }))}
                  />
                </form>
                {wishlistError ? <p className="mt-2 text-sm text-destructive">{wishlistError}</p> : null}
              </CardContent>
            </Card>
            {wishlist.map((item) => (
              <Card key={item.id} size="sm" className="bg-white/80">
                <CardContent className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.priority} · {item.status}</p>
                    {item.notes ? <p className="mt-1 text-sm text-muted-foreground">{item.notes}</p> : null}
                  </div>
                  <p className="font-semibold">{formatRupiah(item.estimatedPrice)}</p>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="receivables" className="space-y-3">
            {repaymentError ? <p className="text-sm text-destructive">{repaymentError}</p> : null}
            {receivables.map((receivable) => {
              const form = repaymentForms[receivable.id] ?? { amount: "", accountId: accounts[0]?.id ?? "" };
              return (
                <Card key={receivable.id} size="sm" className="bg-white/80">
                  <CardContent className="space-y-3">
                    <div className="flex justify-between gap-3">
                      <div>
                        <p className="font-medium">{receivable.personName}</p>
                        <p className="text-xs text-muted-foreground">
                          {receivable.status} · awal {formatRupiah(receivable.originalAmount)}
                        </p>
                      </div>
                      <p className="font-semibold">{formatRupiah(receivable.remainingAmount)}</p>
                    </div>
                    {receivable.payments.length > 0 ? (
                      <div className="space-y-1 text-xs text-muted-foreground">
                        {receivable.payments.map((payment) => (
                          <p key={payment.id}>
                            {new Date(payment.paidAt).toLocaleDateString("id-ID")} · {formatRupiah(payment.amount)}
                          </p>
                        ))}
                      </div>
                    ) : null}
                    {receivable.status === "ACTIVE" ? (
                      <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                        <select
                          className="h-8 rounded-lg border bg-background px-2 text-sm"
                          value={form.accountId}
                          onChange={(event) =>
                            setRepaymentForms((prev) => ({
                              ...prev,
                              [receivable.id]: { ...form, accountId: event.target.value },
                            }))
                          }
                        >
                          {accounts.map((account) => (
                            <option key={account.id} value={account.id}>{account.name}</option>
                          ))}
                        </select>
                        <Input
                          inputMode="numeric"
                          placeholder="Nominal bayar"
                          value={form.amount}
                          onChange={(event) =>
                            setRepaymentForms((prev) => ({
                              ...prev,
                              [receivable.id]: { ...form, amount: event.target.value },
                            }))
                          }
                        />
                        <Button type="button" onClick={() => void submitRepayment(receivable)}>Catat Bayar</Button>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          <TabsContent value="accounts" className="space-y-3">
            <Card size="sm" className="bg-white/80">
              <CardHeader>
                <CardTitle>Tambah Akun</CardTitle>
              </CardHeader>
              <CardContent>
                <form className="grid gap-3 md:grid-cols-[1fr_10rem_auto]" onSubmit={submitAccount}>
                  <Input
                    placeholder="Nama akun"
                    value={accountForm.name}
                    onChange={(event) => setAccountForm((prev) => ({ ...prev, name: event.target.value }))}
                  />
                  <select
                    className="h-8 rounded-lg border bg-background px-2 text-sm"
                    value={accountForm.type}
                    onChange={(event) =>
                      setAccountForm((prev) => ({ ...prev, type: event.target.value as MoneyAccountType }))
                    }
                  >
                    {accountTypes.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                  <Button type="submit">Tambah</Button>
                </form>
                {accountError ? <p className="mt-2 text-sm text-destructive">{accountError}</p> : null}
              </CardContent>
            </Card>
            {accounts.map((account) => (
              <Card key={account.id} size="sm" className="bg-white/80">
                <CardContent className="flex justify-between gap-3">
                  <div>
                    <p className="font-medium">{account.name}</p>
                    <p className="text-xs text-muted-foreground">{account.type}</p>
                  </div>
                  <p className="font-semibold">{formatRupiah(account.balance)}</p>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </main>

      <div className="fixed bottom-5 right-5 z-30 flex flex-col items-end gap-2">
        {fabOpen ? (
          <div className="flex flex-col gap-2 rounded-xl border bg-background p-2 shadow-lg">
            {(["INCOME", "EXPENSE", "TRANSFER", "LEND"] as const).map((type) => (
              <Button key={type} size="sm" variant="ghost" className="justify-start" onClick={() => openTransactionForm(type)}>
                {type === "TRANSFER" ? <Repeat data-icon="inline-start" /> : <WalletCards data-icon="inline-start" />}
                {type === "LEND" ? "Piutang" : type[0] + type.slice(1).toLowerCase()}
              </Button>
            ))}
          </div>
        ) : null}
        <Button size="icon-lg" aria-label="Add transaction" onClick={() => setFabOpen((prev) => !prev)}>
          <Plus />
        </Button>
      </div>

      {activeForm ? (
        <div className="fixed inset-0 z-40 flex items-end bg-black/30 p-3 md:items-center md:justify-center">
          <form className="w-full rounded-xl bg-background p-4 shadow-xl md:max-w-lg" onSubmit={submitTransaction}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {activeForm === "LEND" ? "Tambah Piutang" : `Tambah ${activeForm.toLowerCase()}`}
              </h2>
              <Button type="button" size="sm" variant="ghost" onClick={() => setActiveForm(null)}>Tutup</Button>
            </div>
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="transaction-amount">Nominal</Label>
                <Input
                  id="transaction-amount"
                  inputMode="numeric"
                  value={transactionForm.amount}
                  onChange={(event) => setTransactionForm((prev) => ({ ...prev, amount: event.target.value }))}
                />
              </div>
              {activeForm === "TRANSFER" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <SelectField
                    label="Dari akun"
                    value={transactionForm.fromAccountId}
                    onChange={(value) => setTransactionForm((prev) => ({ ...prev, fromAccountId: value }))}
                    options={accounts.map((account) => ({ value: account.id, label: account.name }))}
                  />
                  <SelectField
                    label="Ke akun"
                    value={transactionForm.toAccountId}
                    onChange={(value) => setTransactionForm((prev) => ({ ...prev, toAccountId: value }))}
                    options={accounts.map((account) => ({ value: account.id, label: account.name }))}
                  />
                </div>
              ) : (
                <SelectField
                  label={activeForm === "LEND" ? "Akun sumber" : "Akun"}
                  value={transactionForm.accountId}
                  onChange={(value) => setTransactionForm((prev) => ({ ...prev, accountId: value }))}
                  options={accounts.map((account) => ({ value: account.id, label: account.name }))}
                />
              )}
              {activeForm === "INCOME" || activeForm === "EXPENSE" ? (
                <SelectField
                  label={activeForm === "EXPENSE" ? "Kategori" : "Kategori opsional"}
                  value={transactionForm.categoryId}
                  onChange={(value) => setTransactionForm((prev) => ({ ...prev, categoryId: value }))}
                  options={(activeForm === "EXPENSE" ? expenseCategories : incomeCategories).map((category) => ({
                    value: category.id,
                    label: category.name,
                  }))}
                  allowEmpty={activeForm === "INCOME"}
                />
              ) : null}
              {activeForm === "LEND" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor="person-name">Nama peminjam</Label>
                    <Input
                      id="person-name"
                      value={transactionForm.personName}
                      onChange={(event) => setTransactionForm((prev) => ({ ...prev, personName: event.target.value }))}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="due-date">Jatuh tempo</Label>
                    <Input
                      id="due-date"
                      type="date"
                      value={transactionForm.dueDate}
                      onChange={(event) => setTransactionForm((prev) => ({ ...prev, dueDate: event.target.value }))}
                    />
                  </div>
                </div>
              ) : null}
              <div className="grid gap-1.5">
                <Label htmlFor="occurred-at">Tanggal</Label>
                <Input
                  id="occurred-at"
                  type="date"
                  value={transactionForm.occurredAt}
                  onChange={(event) => setTransactionForm((prev) => ({ ...prev, occurredAt: event.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="description">Deskripsi</Label>
                <Input
                  id="description"
                  value={transactionForm.description}
                  onChange={(event) => setTransactionForm((prev) => ({ ...prev, description: event.target.value }))}
                />
              </div>
              {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
              <Button type="submit" disabled={saving}>{saving ? "Menyimpan..." : "Simpan"}</Button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  allowEmpty = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  allowEmpty?: boolean;
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <select
        className="h-8 rounded-lg border bg-background px-2 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {allowEmpty ? <option value="">Tanpa kategori</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
