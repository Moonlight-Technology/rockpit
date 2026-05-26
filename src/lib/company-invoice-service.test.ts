import assert from "node:assert/strict";
import test from "node:test";
import {
  applyInvoiceStatusTransition,
  calculateInvoiceTotals,
  createInvoiceForUserWithDependencies,
  formatInvoiceNumber,
  getInvoiceDetailForUserWithDependencies,
  listInvoicesForUserWithDependencies,
  nextInvoiceSequence,
  updateInvoiceStatusForUserWithDependencies,
} from "./company-invoice-service.ts";
import { createInvoiceSchema, updateInvoiceStatusSchema } from "./validators/company-invoice.ts";

async function unexpectedCall<T>(): Promise<T> {
  throw new Error("Unexpected mock call");
}

function createInvoiceDeps(overrides: Record<string, unknown> = {}) {
  const company = {
    id: "company-1",
    ownerId: "user-1",
    name: "Itek",
    slug: "itek",
    description: "",
    quotationPrefix: "ITEK",
  };

  const defaultInvoice = {
    id: "invoice-1",
    companyId: "company-1",
    quotationId: "quotation-1",
    leadId: "lead-1",
    createdByUserId: "user-1",
    invoiceNumber: "ITEK/INV/2026/05/001",
    status: "DRAFT" as const,
    subtotal: 1_000_000,
    total: 1_000_000,
    notes: "",
    issuedAt: null,
    paidAt: null,
    cancelledAt: null,
    createdAt: new Date("2026-05-26T09:00:00.000Z"),
    updatedAt: new Date("2026-05-26T09:00:00.000Z"),
    quotation: {
      id: "quotation-1",
      quotationNumber: "ITEK/QT/2026/05/001",
      revisionNumber: 1,
      status: "APPROVED" as const,
      total: 5_000_000,
    },
    lead: {
      id: "lead-1",
      title: "Website redesign",
      prospectName: "PT Maju",
      estimatedValue: 5_000_000,
    },
    createdBy: {
      id: "user-1",
      name: "Owner",
      email: "owner@example.com",
    },
    lines: [
      {
        id: "line-1",
        invoiceId: "invoice-1",
        description: "DP",
        quantity: 1,
        unitPrice: 1_000_000,
        position: 0,
      },
    ],
  };

  const deps = {
    prisma: {
      company: {
        findFirst: async () => company,
      },
      companyQuotation: {
        findFirst: async () => ({
          id: "quotation-1",
          companyId: "company-1",
          leadId: "lead-1",
          quotationNumber: "ITEK/QT/2026/05/001",
          revisionNumber: 1,
          total: 5_000_000,
          status: "APPROVED" as const,
        }),
        findMany: async () => [],
      },
      companyInvoice: {
        findMany: async () => [],
        findFirst: async () => defaultInvoice,
        aggregate: async () => ({ _sum: { total: 0 } }),
        create: async () => defaultInvoice,
        update: async (args: { data: Record<string, unknown> }) => ({
          ...defaultInvoice,
          ...args.data,
        }),
      },
      $transaction: async <T>(callback: (tx: typeof deps.prisma) => Promise<T>) =>
        callback(deps.prisma),
      ...overrides,
    },
  };

  return deps;
}

test("formatInvoiceNumber builds a company-prefixed sequence number", () => {
  assert.equal(
    formatInvoiceNumber({
      prefix: "ITEK",
      issuedAt: new Date("2026-05-26T00:00:00.000Z"),
      sequence: 7,
    }),
    "ITEK/INV/2026/05/007"
  );
});

test("nextInvoiceSequence increments within the same month", () => {
  assert.equal(
    nextInvoiceSequence({
      prefix: "ITEK",
      issuedAt: new Date("2026-05-26T00:00:00.000Z"),
      existingInvoiceNumbers: ["ITEK/INV/2026/05/001", "ITEK/INV/2026/05/009"],
    }),
    10
  );
});

test("calculateInvoiceTotals sums line items", () => {
  assert.deepEqual(
    calculateInvoiceTotals({
      lines: [
        { description: "DP", quantity: 1, unitPrice: 2_000_000 },
        { description: "Setup", quantity: 2, unitPrice: 500_000 },
      ],
    }),
    { subtotal: 3_000_000, total: 3_000_000 }
  );
});

test("applyInvoiceStatusTransition sets issuedAt when moving draft to sent", () => {
  const now = new Date("2026-05-26T10:00:00.000Z");

  assert.deepEqual(
    applyInvoiceStatusTransition({
      currentStatus: "DRAFT",
      nextStatus: "SENT",
      timestamps: { issuedAt: null, paidAt: null, cancelledAt: null },
      now,
    }),
    {
      changed: true,
      updates: { status: "SENT", issuedAt: now },
    }
  );
});

test("applyInvoiceStatusTransition rejects invalid transitions", () => {
  assert.throws(() =>
    applyInvoiceStatusTransition({
      currentStatus: "PAID",
      nextStatus: "DRAFT",
      timestamps: { issuedAt: new Date(), paidAt: new Date(), cancelledAt: null },
      now: new Date("2026-05-26T10:00:00.000Z"),
    })
  );
});

test("createInvoiceSchema requires quotationId and at least one line", () => {
  const parsed = createInvoiceSchema.parse({
    quotationId: "quotation-1",
    lines: [{ description: "DP", quantity: 1, unitPrice: 500_000 }],
  });

  assert.equal(parsed.quotationId, "quotation-1");
  assert.equal(parsed.lines.length, 1);
});

test("updateInvoiceStatusSchema accepts invoice workflow statuses only", () => {
  assert.equal(updateInvoiceStatusSchema.parse({ status: "PAID" }).status, "PAID");
});

test("listInvoicesForUserWithDependencies rejects non-owners", async () => {
  const deps = createInvoiceDeps({
    company: {
      findFirst: async () => ({
        id: "company-1",
        ownerId: "user-1",
        name: "Itek",
        slug: "itek",
        description: "",
        quotationPrefix: "ITEK",
      }),
    },
  });

  const result = await listInvoicesForUserWithDependencies("user-2", "company-1", deps);

  assert.deepEqual(result, { error: "FORBIDDEN" });
});

test("createInvoiceForUserWithDependencies rejects quotations that are not approved", async () => {
  const deps = createInvoiceDeps({
    companyQuotation: {
      findFirst: async () => ({
        id: "quotation-1",
        companyId: "company-1",
        leadId: "lead-1",
        quotationNumber: "ITEK/QT/2026/05/001",
        revisionNumber: 1,
        total: 5_000_000,
        status: "SENT" as const,
      }),
      findMany: async () => [],
    },
  });

  const result = await createInvoiceForUserWithDependencies(
    {
      userId: "user-1",
      companyId: "company-1",
      payload: {
        quotationId: "quotation-1",
        lines: [{ description: "DP", quantity: 1, unitPrice: 1_000_000 }],
      },
    },
    deps
  );

  assert.deepEqual(result, { error: "QUOTATION_NOT_APPROVED" });
});

test("createInvoiceForUserWithDependencies rejects totals above quotation ceiling", async () => {
  const deps = createInvoiceDeps({
    companyInvoice: {
      findMany: async () => [],
      findFirst: async () => null,
      aggregate: async () => ({ _sum: { total: 4_000_000 } }),
      create: async () => unexpectedCall(),
      update: async () => unexpectedCall(),
    },
  });

  const result = await createInvoiceForUserWithDependencies(
    {
      userId: "user-1",
      companyId: "company-1",
      payload: {
        quotationId: "quotation-1",
        lines: [{ description: "Remaining", quantity: 1, unitPrice: 2_000_000 }],
      },
    },
    deps
  );

  assert.deepEqual(result, { error: "INVOICE_TOTAL_EXCEEDS_QUOTATION" });
});

test("createInvoiceForUserWithDependencies creates draft invoices from approved quotations", async () => {
  const deps = createInvoiceDeps({
    companyInvoice: {
      findMany: async () => [{ invoiceNumber: "ITEK/INV/2026/05/001" }],
      findFirst: async () => null,
      aggregate: async () => ({ _sum: { total: 1_000_000 } }),
      create: async (args: {
        data: {
          invoiceNumber: string;
          subtotal: number;
          total: number;
          status: string;
          notes: string;
        };
      }) => ({
        id: "invoice-2",
        companyId: "company-1",
        quotationId: "quotation-1",
        leadId: "lead-1",
        createdByUserId: "user-1",
        issuedAt: null,
        paidAt: null,
        cancelledAt: null,
        createdAt: new Date("2026-05-26T09:30:00.000Z"),
        updatedAt: new Date("2026-05-26T09:30:00.000Z"),
        invoiceNumber: args.data.invoiceNumber,
        subtotal: args.data.subtotal,
        total: args.data.total,
        status: args.data.status as "DRAFT",
        notes: args.data.notes,
        quotation: {
          id: "quotation-1",
          quotationNumber: "ITEK/QT/2026/05/001",
          revisionNumber: 1,
          status: "APPROVED" as const,
          total: 5_000_000,
        },
        lead: {
          id: "lead-1",
          title: "Website redesign",
          prospectName: "PT Maju",
          estimatedValue: 5_000_000,
        },
        createdBy: {
          id: "user-1",
          name: "Owner",
          email: "owner@example.com",
        },
        lines: [
          {
            id: "line-1",
            invoiceId: "invoice-2",
            description: "DP",
            quantity: 1,
            unitPrice: 1_500_000,
            position: 0,
          },
        ],
      }),
      update: async () => unexpectedCall(),
    },
  });

  const result = await createInvoiceForUserWithDependencies(
    {
      userId: "user-1",
      companyId: "company-1",
      payload: {
        quotationId: "quotation-1",
        lines: [{ description: "DP", quantity: 1, unitPrice: 1_500_000 }],
        notes: "First billing milestone",
      },
    },
    deps
  );

  assert.equal("data" in result, true);
  if ("data" in result) {
    assert.equal(result.data.status, "DRAFT");
    assert.equal(result.data.total, 1_500_000);
    assert.match(result.data.invoiceNumber, /^ITEK\/INV\/2026\/05\/002$/);
  }
});

test("getInvoiceDetailForUserWithDependencies returns not found for missing invoices", async () => {
  const deps = createInvoiceDeps({
    companyInvoice: {
      findMany: async () => [],
      findFirst: async () => null,
      aggregate: async () => ({ _sum: { total: 0 } }),
      create: async () => unexpectedCall(),
      update: async () => unexpectedCall(),
    },
  });

  const result = await getInvoiceDetailForUserWithDependencies(
    {
      userId: "user-1",
      companyId: "company-1",
      invoiceId: "missing",
    },
    deps
  );

  assert.deepEqual(result, { error: "NOT_FOUND" });
});

test("updateInvoiceStatusForUserWithDependencies marks sent invoices as paid", async () => {
  const result = await updateInvoiceStatusForUserWithDependencies(
    {
      userId: "user-1",
      companyId: "company-1",
      invoiceId: "invoice-1",
      payload: { status: "PAID" },
    },
    createInvoiceDeps({
      companyInvoice: {
        findMany: async () => [],
        findFirst: async () => ({
          id: "invoice-1",
          companyId: "company-1",
          quotationId: "quotation-1",
          leadId: "lead-1",
          createdByUserId: "user-1",
          invoiceNumber: "ITEK/INV/2026/05/001",
          status: "SENT" as const,
          subtotal: 1_000_000,
          total: 1_000_000,
          notes: "",
          issuedAt: new Date("2026-05-26T08:00:00.000Z"),
          paidAt: null,
          cancelledAt: null,
          createdAt: new Date("2026-05-26T07:00:00.000Z"),
          updatedAt: new Date("2026-05-26T08:00:00.000Z"),
          quotation: {
            id: "quotation-1",
            quotationNumber: "ITEK/QT/2026/05/001",
            revisionNumber: 1,
            status: "APPROVED" as const,
            total: 5_000_000,
          },
          lead: {
            id: "lead-1",
            title: "Website redesign",
            prospectName: "PT Maju",
            estimatedValue: 5_000_000,
          },
          createdBy: {
            id: "user-1",
            name: "Owner",
            email: "owner@example.com",
          },
          lines: [],
        }),
        aggregate: async () => ({ _sum: { total: 0 } }),
        create: async () => unexpectedCall(),
        update: async (args: { data: Record<string, unknown> }) => ({
          id: "invoice-1",
          companyId: "company-1",
          quotationId: "quotation-1",
          leadId: "lead-1",
          createdByUserId: "user-1",
          invoiceNumber: "ITEK/INV/2026/05/001",
          status: args.data.status as "PAID",
          subtotal: 1_000_000,
          total: 1_000_000,
          notes: "",
          issuedAt: new Date("2026-05-26T08:00:00.000Z"),
          paidAt: args.data.paidAt as Date,
          cancelledAt: null,
          createdAt: new Date("2026-05-26T07:00:00.000Z"),
          updatedAt: new Date("2026-05-26T09:00:00.000Z"),
          quotation: {
            id: "quotation-1",
            quotationNumber: "ITEK/QT/2026/05/001",
            revisionNumber: 1,
            status: "APPROVED" as const,
            total: 5_000_000,
          },
          lead: {
            id: "lead-1",
            title: "Website redesign",
            prospectName: "PT Maju",
            estimatedValue: 5_000_000,
          },
          createdBy: {
            id: "user-1",
            name: "Owner",
            email: "owner@example.com",
          },
          lines: [],
        }),
      },
    })
  );

  assert.equal("data" in result, true);
  if ("data" in result) {
    assert.equal(result.data.status, "PAID");
    assert.ok(result.data.paidAt instanceof Date);
  }
});

test("updateInvoiceStatusForUserWithDependencies rejects invalid transitions", async () => {
  const result = await updateInvoiceStatusForUserWithDependencies(
    {
      userId: "user-1",
      companyId: "company-1",
      invoiceId: "invoice-1",
      payload: { status: "DRAFT" },
    },
    createInvoiceDeps({
      companyInvoice: {
        findMany: async () => [],
        findFirst: async () => ({
          id: "invoice-1",
          companyId: "company-1",
          quotationId: "quotation-1",
          leadId: "lead-1",
          createdByUserId: "user-1",
          invoiceNumber: "ITEK/INV/2026/05/001",
          status: "PAID" as const,
          subtotal: 1_000_000,
          total: 1_000_000,
          notes: "",
          issuedAt: new Date("2026-05-26T08:00:00.000Z"),
          paidAt: new Date("2026-05-26T09:00:00.000Z"),
          cancelledAt: null,
          createdAt: new Date("2026-05-26T07:00:00.000Z"),
          updatedAt: new Date("2026-05-26T09:00:00.000Z"),
          quotation: {
            id: "quotation-1",
            quotationNumber: "ITEK/QT/2026/05/001",
            revisionNumber: 1,
            status: "APPROVED" as const,
            total: 5_000_000,
          },
          lead: {
            id: "lead-1",
            title: "Website redesign",
            prospectName: "PT Maju",
            estimatedValue: 5_000_000,
          },
          createdBy: {
            id: "user-1",
            name: "Owner",
            email: "owner@example.com",
          },
          lines: [],
        }),
        aggregate: async () => ({ _sum: { total: 0 } }),
        create: async () => unexpectedCall(),
        update: async () => unexpectedCall(),
      },
    })
  );

  assert.deepEqual(result, { error: "INVALID_STATUS_TRANSITION" });
});
