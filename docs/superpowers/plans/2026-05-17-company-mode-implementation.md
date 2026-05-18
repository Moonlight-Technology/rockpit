# Company Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a premium `Company Mode` that supports permanent user unlock, multi-company ownership, a dedicated dark-mode company shell, lead boards, quotation revisions, conversion of won leads into company project boards, and invited collaborator access to lead boards or project boards only.

**Architecture:** Extend the current user-centric app with a bounded company domain instead of forking the existing product. Reuse the current `Board` and `Task` engine for delivery projects, add company-specific entities for unlock, companies, leads, lead-board membership, and quotations, then expose the business workflow through dedicated company routes and a separate dark-mode UI shell.

**Tech Stack:** Next.js 16 App Router, React 19 client/server components, TypeScript, NextAuth JWT sessions, Prisma with PostgreSQL, Zod validation, Tailwind/shadcn UI primitives, Node 22 `node --test --experimental-strip-types`, ESLint.

---

## Context And Constraints

- Read and follow the relevant Next.js 16 docs in `node_modules/next/dist/docs/` before changing route handlers, layouts, or client boundaries.
- Keep the existing personal flow working: `/`, `/boards`, `/boards/[id]`, `/tasks`, `/planner`, `/money-manager`, and `/helicopter` must continue to behave as before.
- Keep premium unlock enforcement server-side. Do not embed `MAMAT-METAL` in client-only checks.
- Reuse the current `Board` and `BoardMember` system for company project boards. Do not build a second task engine.
- Keep collaborator access narrow in v1:
  - company owners get full company access
  - invited collaborators get only the specific lead boards or project boards they were invited to
- Prefer focused new modules over growing `src/app/page.tsx` and `src/lib/board-service.ts` into company-aware god files.
- Use `apply_patch` for code edits.

## File Map

- Modify `prisma/schema.prisma`: add premium unlock, company, lead board, lead, quotation, and company-aware board fields.
- Create `prisma/migrations/20260517090000_company_mode_foundation/migration.sql`: schema changes for company mode.
- Create `src/lib/company-premium.ts`: server-safe premium key check and helper functions.
- Create `src/lib/company-premium.test.ts`: tests for unlock validation behavior.
- Create `src/lib/company-auth.ts`: owner-level and invited-resource authorization helpers.
- Create `src/lib/company-service.ts`: CRUD for companies, onboarding, and company switcher data.
- Create `src/lib/company-lead-service.ts`: lead board, lead card, and lead invitation behavior.
- Create `src/lib/company-quotation-service.ts`: quotation numbering, revision creation, and detail retrieval.
- Create `src/lib/company-conversion-service.ts`: lead-won to company-project-board conversion.
- Create `src/lib/company-overview.ts`: pure helpers for lead-board grouping and company dashboard metrics.
- Create `src/lib/company-overview.test.ts`: tests for summary calculations.
- Create `src/lib/validators/company.ts`: company onboarding and update schemas.
- Create `src/lib/validators/company-lead.ts`: lead board and lead card validation schemas.
- Create `src/lib/validators/company-quotation.ts`: quotation and revision validation schemas.
- Modify `src/lib/auth.ts`: include premium and owned-company switcher claims in session lookups if needed.
- Modify `src/types/next-auth.d.ts`: extend session typing for premium and active company metadata if used in session payloads.
- Modify `middleware.ts`: protect company routes while preserving collaborator-accessible shared routes.
- Modify `src/app/page.tsx`: add workspace switcher entry point and locked-state affordance for `Company Mode`.
- Create `src/app/company/[companyId]/layout.tsx`: dark-mode shell layout for company mode.
- Create `src/app/company/[companyId]/page.tsx`: company overview dashboard.
- Create `src/app/company/[companyId]/leads/page.tsx`: lead board page.
- Create `src/app/company/[companyId]/quotations/page.tsx`: quotation list page.
- Create `src/app/company/[companyId]/quotations/[quotationId]/page.tsx`: shareable or printable quotation detail page.
- Create `src/app/company/[companyId]/projects/page.tsx`: project list entry into company boards.
- Create `src/app/company/[companyId]/settings/page.tsx`: company profile and prefix settings.
- Create `src/components/company/company-shell.tsx`: shell frame and sidebar.
- Create `src/components/company/company-switcher.tsx`: personal/company mode switcher UI.
- Create `src/components/company/company-unlock-dialog.tsx`: unlock flow UI.
- Create `src/components/company/company-onboarding-form.tsx`: company setup form.
- Create `src/components/company/lead-board.tsx`: company lead board UI.
- Create `src/components/company/quotation-editor.tsx`: quotation creation or revision form UI.
- Create `src/components/company/overview-metrics.tsx`: company dashboard summary cards.
- Create `src/app/api/company/unlock/route.ts`: premium unlock endpoint.
- Create `src/app/api/companies/route.ts`: company list and company creation endpoints.
- Create `src/app/api/companies/[companyId]/route.ts`: company detail update endpoint.
- Create `src/app/api/companies/[companyId]/overview/route.ts`: overview metrics endpoint.
- Create `src/app/api/companies/[companyId]/leads/route.ts`: lead board detail and lead creation endpoint.
- Create `src/app/api/companies/[companyId]/leads/[leadId]/route.ts`: lead update endpoint.
- Create `src/app/api/companies/[companyId]/leads/[leadId]/convert/route.ts`: lead-to-project conversion endpoint.
- Create `src/app/api/companies/[companyId]/lead-members/route.ts`: lead-board invitation endpoint.
- Create `src/app/api/companies/[companyId]/quotations/route.ts`: quotation create and list endpoint.
- Create `src/app/api/companies/[companyId]/quotations/[quotationId]/route.ts`: quotation detail and revision endpoint.

## Shared Types And Constants

Use these shared types in `src/lib/company-premium.ts`, `src/lib/company-service.ts`, `src/lib/company-lead-service.ts`, and `src/lib/company-quotation-service.ts`:

```ts
export type CompanyBusinessType = "JASA";

export type CompanyWorkspaceSummary = {
  id: string;
  name: string;
  slug: string;
  quotationPrefix: string;
};

export type CompanyOverviewMetrics = {
  openPipelineValue: number;
  quotationDraftValue: number;
  wonValueThisMonth: number;
  activeProjectCount: number;
};

export type CompanyLeadStage =
  | "NEW"
  | "QUALIFIED"
  | "PROPOSAL"
  | "NEGOTIATION"
  | "WON"
  | "LOST";

export type CompanyQuotationStatus =
  | "DRAFT"
  | "SENT"
  | "APPROVED"
  | "REJECTED";
```

Use this server-side constant in `src/lib/company-premium.ts`:

```ts
export const COMPANY_MODE_UNLOCK_CODE = "MAMAT-METAL";
```

## Task 1: Add Company Mode Schema And Premium Foundation

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260517090000_company_mode_foundation/migration.sql`
- Create: `src/lib/company-premium.ts`
- Create: `src/lib/company-premium.test.ts`
- Modify: `src/types/next-auth.d.ts`

- [ ] **Step 1: Write the failing premium helper test**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  COMPANY_MODE_UNLOCK_CODE,
  isValidCompanyUnlockCode,
  normalizeQuotationPrefix,
} from "./company-premium.ts";

test("isValidCompanyUnlockCode accepts the exact configured unlock code", () => {
  assert.equal(COMPANY_MODE_UNLOCK_CODE, "MAMAT-METAL");
  assert.equal(isValidCompanyUnlockCode("MAMAT-METAL"), true);
});

test("isValidCompanyUnlockCode trims whitespace and rejects wrong values", () => {
  assert.equal(isValidCompanyUnlockCode("  MAMAT-METAL  "), true);
  assert.equal(isValidCompanyUnlockCode("mamat-metal"), false);
  assert.equal(isValidCompanyUnlockCode("MAMAT"), false);
});

test("normalizeQuotationPrefix uppercases and strips unsupported characters", () => {
  assert.equal(normalizeQuotationPrefix("mamat"), "MAMAT");
  assert.equal(normalizeQuotationPrefix(" mamat/qt "), "MAMATQT");
  assert.equal(normalizeQuotationPrefix("ab-12"), "AB12");
});
```

- [ ] **Step 2: Run the premium helper test to verify it fails**

Run: `node --test --experimental-strip-types src/lib/company-premium.test.ts`

Expected: FAIL with `Cannot find module` or missing export errors for `company-premium.ts`.

- [ ] **Step 3: Add the schema foundation for premium and company mode**

Update `prisma/schema.prisma` with these additions:

```prisma
enum CompanyBusinessType {
  JASA
}

enum CompanyLeadStage {
  NEW
  QUALIFIED
  PROPOSAL
  NEGOTIATION
  WON
  LOST
}

enum CompanyQuotationStatus {
  DRAFT
  SENT
  APPROVED
  REJECTED
}

enum WorkspaceType {
  PERSONAL
  COMPANY
}

model UserPremiumUnlock {
  id           String   @id @default(cuid())
  userId        String   @unique
  unlockSource  String
  unlockedAt    DateTime @default(now())
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Company {
  id               String               @id @default(cuid())
  ownerId          String
  name             String
  slug             String
  description      String               @default("")
  businessType     CompanyBusinessType  @default(JASA)
  quotationPrefix  String
  owner            User                 @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  leadBoards       CompanyLeadBoard[]
  leads            CompanyLead[]
  quotations       CompanyQuotation[]
  boards           Board[]
  createdAt        DateTime             @default(now())
  updatedAt        DateTime             @updatedAt

  @@unique([ownerId, slug])
  @@unique([ownerId, quotationPrefix])
}

model CompanyLeadBoard {
  id          String                 @id @default(cuid())
  companyId   String
  name        String
  description String                 @default("")
  company     Company                @relation(fields: [companyId], references: [id], onDelete: Cascade)
  columns     CompanyLeadColumn[]
  leads       CompanyLead[]
  members     CompanyLeadBoardMember[]
  createdAt   DateTime               @default(now())
  updatedAt   DateTime               @updatedAt
}

model CompanyLeadBoardMember {
  id          String           @id @default(cuid())
  leadBoardId String
  userId      String
  role        BoardRole        @default(MEMBER)
  leadBoard   CompanyLeadBoard @relation(fields: [leadBoardId], references: [id], onDelete: Cascade)
  user        User             @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([leadBoardId, userId])
}

model CompanyLeadColumn {
  id          String           @id @default(cuid())
  leadBoardId String
  title       String
  position    Int
  leadBoard   CompanyLeadBoard @relation(fields: [leadBoardId], references: [id], onDelete: Cascade)
  leads       CompanyLead[]

  @@index([leadBoardId, position])
}

model CompanyLead {
  id                      String            @id @default(cuid())
  companyId               String
  leadBoardId             String
  columnId                String
  ownerUserId             String
  title                   String
  prospectName            String
  estimatedValue          Int
  notes                   String            @default("")
  stage                   CompanyLeadStage  @default(NEW)
  wonAt                   DateTime?
  convertedProjectBoardId String?           @unique
  company                 Company           @relation(fields: [companyId], references: [id], onDelete: Cascade)
  leadBoard               CompanyLeadBoard  @relation(fields: [leadBoardId], references: [id], onDelete: Cascade)
  column                  CompanyLeadColumn @relation(fields: [columnId], references: [id], onDelete: Cascade)
  owner                   User              @relation(fields: [ownerUserId], references: [id], onDelete: Cascade)
  quotations              CompanyQuotation[]
  createdAt               DateTime          @default(now())
  updatedAt               DateTime          @updatedAt
}

model CompanyQuotation {
  id              String                 @id @default(cuid())
  companyId       String
  leadId          String
  quotationNumber String
  revisionNumber  Int
  status          CompanyQuotationStatus @default(DRAFT)
  subtotal        Int
  total           Int
  issuedAt        DateTime?
  createdByUserId String
  company         Company                @relation(fields: [companyId], references: [id], onDelete: Cascade)
  lead            CompanyLead            @relation(fields: [leadId], references: [id], onDelete: Cascade)
  createdBy       User                   @relation(fields: [createdByUserId], references: [id], onDelete: Cascade)
  lines           CompanyQuotationLine[]
  createdAt       DateTime               @default(now())
  updatedAt       DateTime               @updatedAt

  @@unique([leadId, revisionNumber])
  @@unique([companyId, quotationNumber, revisionNumber])
}

model CompanyQuotationLine {
  id          String           @id @default(cuid())
  quotationId String
  description String
  quantity    Int
  unitPrice   Int
  lineTotal   Int
  position    Int
  quotation   CompanyQuotation @relation(fields: [quotationId], references: [id], onDelete: Cascade)

  @@index([quotationId, position])
}
```

Extend `User` and `Board`:

```prisma
model User {
  premiumUnlock   UserPremiumUnlock?
  ownedCompanies  Company[]
  companyLeadBoards CompanyLeadBoardMember[]
  ownedLeads      CompanyLead[]
  createdQuotations CompanyQuotation[]
}

model Board {
  workspaceType WorkspaceType @default(PERSONAL)
  companyId     String?
  sourceLeadId  String?       @unique
  company       Company?      @relation(fields: [companyId], references: [id], onDelete: SetNull)
}
```

- [ ] **Step 4: Implement the premium helper and extend auth typing**

Create `src/lib/company-premium.ts`:

```ts
export const COMPANY_MODE_UNLOCK_CODE = "MAMAT-METAL";

export function isValidCompanyUnlockCode(code: string) {
  return code.trim() === COMPANY_MODE_UNLOCK_CODE;
}

export function normalizeQuotationPrefix(input: string) {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}
```

Extend `src/types/next-auth.d.ts`:

```ts
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      hasCompanyMode?: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    hasCompanyMode?: boolean;
  }
}
```

- [ ] **Step 5: Run targeted verification**

Run:

```bash
node --test --experimental-strip-types src/lib/company-premium.test.ts
npx prisma validate
```

Expected:

- test file PASS
- Prisma schema validation succeeds

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260517090000_company_mode_foundation/migration.sql src/lib/company-premium.ts src/lib/company-premium.test.ts src/types/next-auth.d.ts
git commit -m "feat: add company mode schema foundation"
```

## Task 2: Add Company Auth, Unlock API, And Workspace Switcher Foundation

**Files:**
- Modify: `src/lib/auth.ts`
- Create: `src/lib/company-auth.ts`
- Create: `src/app/api/company/unlock/route.ts`
- Create: `src/app/api/companies/route.ts`
- Modify: `src/app/page.tsx`
- Create: `src/components/company/company-switcher.tsx`
- Create: `src/components/company/company-unlock-dialog.tsx`

- [ ] **Step 1: Write the failing auth helper test**

Create `src/lib/company-auth.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { canOpenCompanyShell } from "./company-auth.ts";

test("canOpenCompanyShell allows premium owners", () => {
  assert.equal(
    canOpenCompanyShell({ isOwner: true, hasPremiumUnlock: true, invitedLeadBoardIds: [] }),
    true
  );
});

test("canOpenCompanyShell rejects invited non-premium collaborators", () => {
  assert.equal(
    canOpenCompanyShell({
      isOwner: false,
      hasPremiumUnlock: false,
      invitedLeadBoardIds: ["lead-board-1"],
    }),
    false
  );
});
```

- [ ] **Step 2: Run the auth helper test to verify it fails**

Run: `node --test --experimental-strip-types src/lib/company-auth.test.ts`

Expected: FAIL because `company-auth.ts` does not exist yet.

- [ ] **Step 3: Implement company auth and unlock endpoints**

Create `src/lib/company-auth.ts`:

```ts
export function canOpenCompanyShell(input: {
  isOwner: boolean;
  hasPremiumUnlock: boolean;
  invitedLeadBoardIds: string[];
}) {
  return input.isOwner && input.hasPremiumUnlock;
}
```

Create `src/app/api/company/unlock/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId, unauthorized, validationError } from "@/lib/api";
import { isValidCompanyUnlockCode } from "@/lib/company-premium";

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const payload = await req.json().catch(() => null);
  const code = typeof payload?.code === "string" ? payload.code : "";
  if (!isValidCompanyUnlockCode(code)) {
    return validationError("Invalid premium code.");
  }

  await prisma.userPremiumUnlock.upsert({
    where: { userId },
    create: { userId, unlockSource: "manual_code" },
    update: {},
  });

  return NextResponse.json({ ok: true });
}
```

Create `src/app/api/companies/route.ts` with owner-only list/create:

```ts
import { NextResponse } from "next/server";
import { getSessionUserId, unauthorized } from "@/lib/api";
import { createCompanyForUser, listCompaniesForUser } from "@/lib/company-service";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();
  const companies = await listCompaniesForUser(userId);
  return NextResponse.json({ ok: true, data: companies });
}

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();
  const payload = await req.json();
  const company = await createCompanyForUser(userId, payload);
  return NextResponse.json({ ok: true, data: company }, { status: 201 });
}
```

- [ ] **Step 4: Add the switcher and locked-state UI on the home page**

Create `src/components/company/company-switcher.tsx`:

```tsx
type CompanySwitcherProps = {
  hasCompanyMode: boolean;
  companies: { id: string; name: string }[];
  onOpenLockedMode: () => void;
};

export function CompanySwitcher({
  hasCompanyMode,
  companies,
  onOpenLockedMode,
}: CompanySwitcherProps) {
  return (
    <div className="flex items-center gap-2">
      <button type="button" className="rounded-full border px-3 py-1.5 text-sm font-medium">
        Personal
      </button>
      {hasCompanyMode ? (
        companies.map((company) => (
          <a
            key={company.id}
            href={`/company/${company.id}`}
            className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white"
          >
            {company.name}
          </a>
        ))
      ) : (
        <button
          type="button"
          onClick={onOpenLockedMode}
          className="rounded-full border border-amber-400/40 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-900"
        >
          Company Mode
        </button>
      )}
    </div>
  );
}
```

Modify `src/app/page.tsx` to fetch `/api/companies`, render `CompanySwitcher`, and open `CompanyUnlockDialog` when needed.

- [ ] **Step 5: Run verification**

Run:

```bash
node --test --experimental-strip-types src/lib/company-auth.test.ts
npm run lint -- src/app/page.tsx src/lib/auth.ts src/components/company/company-switcher.tsx src/components/company/company-unlock-dialog.tsx src/app/api/company/unlock/route.ts src/app/api/companies/route.ts
```

Expected:

- helper test PASS
- lint passes for the touched files

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth.ts src/lib/company-auth.ts src/lib/company-auth.test.ts src/app/api/company/unlock/route.ts src/app/api/companies/route.ts src/app/page.tsx src/components/company
git commit -m "feat: add company mode unlock and switcher foundation"
```

## Task 3: Implement Company Service, Onboarding, And Dark Shell

**Files:**
- Create: `src/lib/company-service.ts`
- Create: `src/lib/validators/company.ts`
- Create: `src/app/company/[companyId]/layout.tsx`
- Create: `src/app/company/[companyId]/settings/page.tsx`
- Create: `src/components/company/company-shell.tsx`
- Create: `src/components/company/company-onboarding-form.tsx`
- Create: `src/app/api/companies/[companyId]/route.ts`
- Modify: `middleware.ts`

- [ ] **Step 1: Write the failing company validator test**

Create `src/lib/validators/company.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { createCompanySchema } from "./company.ts";

test("createCompanySchema defaults business type to JASA and normalizes prefix", () => {
  const parsed = createCompanySchema.parse({
    name: "Mamat Metal Works",
    quotationPrefix: "mamat/qt",
  });

  assert.equal(parsed.businessType, "JASA");
  assert.equal(parsed.quotationPrefix, "MAMATQT");
});
```

- [ ] **Step 2: Run the validator test to verify it fails**

Run: `node --test --experimental-strip-types src/lib/validators/company.test.ts`

Expected: FAIL because `src/lib/validators/company.ts` does not exist yet.

- [ ] **Step 3: Implement company service, schema, and settings route**

Create `src/lib/validators/company.ts`:

```ts
import { z } from "zod";
import { normalizeQuotationPrefix } from "@/lib/company-premium";

export const createCompanySchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).default(""),
  businessType: z.literal("JASA").default("JASA"),
  quotationPrefix: z
    .string()
    .trim()
    .min(2)
    .max(12)
    .transform((value) => normalizeQuotationPrefix(value))
    .refine((value) => value.length >= 2, "Quotation prefix is required."),
});
```

Create `src/lib/company-service.ts` with:

```ts
export async function listCompaniesForUser(userId: string) {
  return prisma.company.findMany({
    where: { ownerId: userId },
    select: { id: true, name: true, slug: true, quotationPrefix: true },
    orderBy: { createdAt: "asc" },
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
      data: ["New", "Qualified", "Proposal", "Negotiation", "Won", "Lost"].map((title, index) => ({
        leadBoardId: leadBoard.id,
        title,
        position: index,
      })),
    });

    return company;
  });
}
```

Create `src/app/company/[companyId]/layout.tsx` and `src/components/company/company-shell.tsx` to provide the dark shell and navigation.

- [ ] **Step 4: Add middleware protection for company pages**

Update `middleware.ts`:

```ts
const protectedPaths = ["/", "/boards", "/company"];
```

Keep `/api` excluded, and make sure collaborator-accessible board pages remain available through existing board auth rather than blanket company-shell access.

- [ ] **Step 5: Run verification**

Run:

```bash
node --test --experimental-strip-types src/lib/validators/company.test.ts
npm run lint -- src/lib/company-service.ts src/lib/validators/company.ts src/app/company/[companyId]/layout.tsx src/components/company/company-shell.tsx src/components/company/company-onboarding-form.tsx src/app/api/companies/[companyId]/route.ts middleware.ts
```

Expected: validator test PASS and lint passes.

- [ ] **Step 6: Commit**

```bash
git add src/lib/company-service.ts src/lib/validators/company.ts src/lib/validators/company.test.ts src/app/company src/components/company/company-shell.tsx src/components/company/company-onboarding-form.tsx src/app/api/companies/[companyId]/route.ts middleware.ts
git commit -m "feat: add company shell and onboarding flow"
```

## Task 4: Build Lead Board Data And UI

**Files:**
- Create: `src/lib/validators/company-lead.ts`
- Create: `src/lib/company-lead-service.ts`
- Create: `src/app/api/companies/[companyId]/leads/route.ts`
- Create: `src/app/api/companies/[companyId]/leads/[leadId]/route.ts`
- Create: `src/app/api/companies/[companyId]/lead-members/route.ts`
- Create: `src/app/company/[companyId]/leads/page.tsx`
- Create: `src/components/company/lead-board.tsx`

- [ ] **Step 1: Write the failing lead service test**

Create `src/lib/company-overview.test.ts` with a lead-board shape check that forces the service contract:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { groupLeadsByColumn } from "./company-overview.ts";

test("groupLeadsByColumn returns columns in position order with estimated value totals", () => {
  const grouped = groupLeadsByColumn(
    [
      { id: "proposal", title: "Proposal", position: 2 },
      { id: "new", title: "New", position: 0 },
    ],
    [
      { id: "lead-1", columnId: "new", estimatedValue: 5000000 },
      { id: "lead-2", columnId: "proposal", estimatedValue: 2500000 },
    ]
  );

  assert.deepEqual(grouped.map((column) => column.id), ["new", "proposal"]);
  assert.deepEqual(grouped.map((column) => column.totalEstimatedValue), [5000000, 2500000]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test --experimental-strip-types src/lib/company-overview.test.ts`

Expected: FAIL because `groupLeadsByColumn` is missing.

- [ ] **Step 3: Implement lead validation, service, and API routes**

Create `src/lib/validators/company-lead.ts`:

```ts
import { z } from "zod";

export const createLeadSchema = z.object({
  title: z.string().trim().min(2).max(120),
  prospectName: z.string().trim().min(2).max(120),
  estimatedValue: z.coerce.number().int().min(0),
  notes: z.string().trim().max(2000).default(""),
  columnId: z.string().trim().min(1),
});
```

Create `src/lib/company-lead-service.ts` with owner and invite-aware helpers:

```ts
export async function getLeadBoardForUser(userId: string, companyId: string) {
  return prisma.companyLeadBoard.findFirst({
    where: {
      companyId,
      OR: [
        { company: { ownerId: userId } },
        { members: { some: { userId } } },
      ],
    },
    include: {
      columns: { orderBy: { position: "asc" } },
      leads: { orderBy: { createdAt: "asc" } },
    },
  });
}
```

Create `src/lib/company-overview.ts` with the lead-board grouping helper:

```ts
export function groupLeadsByColumn(
  columns: Array<{ id: string; title: string; position: number }>,
  leads: Array<{ id: string; columnId: string; estimatedValue: number }>
) {
  return [...columns]
    .sort((a, b) => a.position - b.position)
    .map((column) => {
      const columnLeads = leads.filter((lead) => lead.columnId === column.id);
      return {
        ...column,
        leads: columnLeads,
        totalEstimatedValue: columnLeads.reduce(
          (sum, lead) => sum + lead.estimatedValue,
          0
        ),
      };
    });
}
```

Create `src/app/api/companies/[companyId]/lead-members/route.ts` to invite collaborators by email into the company lead board.

- [ ] **Step 4: Implement the lead board page and kanban component**

Create `src/components/company/lead-board.tsx`:

```tsx
type LeadBoardProps = {
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

export function LeadBoard({ columns }: LeadBoardProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-3 xl:grid-cols-6">
      {columns.map((column) => (
        <section key={column.id} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
          <header className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">{column.title}</h2>
            <span className="text-xs text-zinc-400">
              Rp{column.totalEstimatedValue.toLocaleString("id-ID")}
            </span>
          </header>
          <div className="space-y-3">
            {column.leads.map((lead) => (
              <article key={lead.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
                <p className="text-sm font-medium text-white">{lead.title}</p>
                <p className="mt-1 text-xs text-zinc-400">{lead.prospectName}</p>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Run verification**

Run:

```bash
node --test --experimental-strip-types src/lib/company-overview.test.ts
npm run lint -- src/lib/validators/company-lead.ts src/lib/company-lead-service.ts src/app/api/companies/[companyId]/leads/route.ts src/app/api/companies/[companyId]/leads/[leadId]/route.ts src/app/api/companies/[companyId]/lead-members/route.ts src/app/company/[companyId]/leads/page.tsx src/components/company/lead-board.tsx
```

Expected: helper test PASS and lint passes.

- [ ] **Step 6: Commit**

```bash
git add src/lib/validators/company-lead.ts src/lib/company-lead-service.ts src/lib/company-overview.ts src/lib/company-overview.test.ts src/app/api/companies/[companyId]/leads src/app/api/companies/[companyId]/lead-members/route.ts src/app/company/[companyId]/leads/page.tsx src/components/company/lead-board.tsx
git commit -m "feat: add company lead board workflow"
```

## Task 5: Build Quotation Numbering, Revisions, And Detail Page

**Files:**
- Create: `src/lib/validators/company-quotation.ts`
- Create: `src/lib/company-quotation-service.ts`
- Create: `src/app/api/companies/[companyId]/quotations/route.ts`
- Create: `src/app/api/companies/[companyId]/quotations/[quotationId]/route.ts`
- Create: `src/app/company/[companyId]/quotations/page.tsx`
- Create: `src/app/company/[companyId]/quotations/[quotationId]/page.tsx`
- Create: `src/components/company/quotation-editor.tsx`

- [ ] **Step 1: Write the failing quotation numbering test**

Create `src/lib/company-quotation-service.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { formatQuotationNumber, nextRevisionNumber } from "./company-quotation-service.ts";

test("formatQuotationNumber builds a company-prefixed sequence number", () => {
  assert.equal(
    formatQuotationNumber({
      prefix: "MAMAT",
      issuedAt: new Date("2026-05-17T00:00:00.000Z"),
      sequence: 7,
    }),
    "MAMAT/QT/2026/05/007"
  );
});

test("nextRevisionNumber increments from the latest revision", () => {
  assert.equal(nextRevisionNumber([]), 1);
  assert.equal(nextRevisionNumber([{ revisionNumber: 1 }, { revisionNumber: 2 }]), 3);
});
```

- [ ] **Step 2: Run the quotation numbering test to verify it fails**

Run: `node --test --experimental-strip-types src/lib/company-quotation-service.test.ts`

Expected: FAIL because `company-quotation-service.ts` does not exist yet.

- [ ] **Step 3: Implement quotation validation and numbering helpers**

Create `src/lib/validators/company-quotation.ts`:

```ts
import { z } from "zod";

export const quotationLineSchema = z.object({
  description: z.string().trim().min(1).max(200),
  quantity: z.coerce.number().int().min(1),
  unitPrice: z.coerce.number().int().min(0),
});

export const createQuotationSchema = z.object({
  leadId: z.string().trim().min(1),
  lines: z.array(quotationLineSchema).min(1),
  status: z.enum(["DRAFT", "SENT", "APPROVED", "REJECTED"]).default("DRAFT"),
});
```

Create `src/lib/company-quotation-service.ts`:

```ts
import { format } from "date-fns";

export function formatQuotationNumber(input: {
  prefix: string;
  issuedAt: Date;
  sequence: number;
}) {
  return `${input.prefix}/QT/${format(input.issuedAt, "yyyy/MM")}/${String(input.sequence).padStart(3, "0")}`;
}

export function nextRevisionNumber(items: Array<{ revisionNumber: number }>) {
  return items.length === 0 ? 1 : Math.max(...items.map((item) => item.revisionNumber)) + 1;
}
```

- [ ] **Step 4: Implement quotation list, editor, and detail page**

Create `src/components/company/quotation-editor.tsx` with a simple revision-capable line-item form.

The initial page contract should support:

```tsx
type QuotationEditorProps = {
  leadId: string;
  initialStatus?: "DRAFT" | "SENT" | "APPROVED" | "REJECTED";
  initialLines?: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
  }>;
};
```

Create `src/app/company/[companyId]/quotations/[quotationId]/page.tsx` as a printable dark-to-light detail page that shows:

- company name
- quotation number
- revision number
- lead or client name
- line items
- subtotal and total

- [ ] **Step 5: Run verification**

Run:

```bash
node --test --experimental-strip-types src/lib/company-quotation-service.test.ts
npm run lint -- src/lib/validators/company-quotation.ts src/lib/company-quotation-service.ts src/app/api/companies/[companyId]/quotations/route.ts src/app/api/companies/[companyId]/quotations/[quotationId]/route.ts src/app/company/[companyId]/quotations/page.tsx src/app/company/[companyId]/quotations/[quotationId]/page.tsx src/components/company/quotation-editor.tsx
```

Expected: helper tests PASS and lint passes.

- [ ] **Step 6: Commit**

```bash
git add src/lib/validators/company-quotation.ts src/lib/company-quotation-service.ts src/lib/company-quotation-service.test.ts src/app/api/companies/[companyId]/quotations src/app/company/[companyId]/quotations src/components/company/quotation-editor.tsx
git commit -m "feat: add company quotations and revisions"
```

## Task 6: Convert Won Leads Into Company Project Boards

**Files:**
- Create: `src/lib/company-conversion-service.ts`
- Create: `src/app/api/companies/[companyId]/leads/[leadId]/convert/route.ts`
- Modify: `src/lib/board-service.ts`
- Create: `src/app/company/[companyId]/projects/page.tsx`

- [ ] **Step 1: Write the failing conversion helper test**

Create `src/lib/company-conversion-service.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { canConvertLeadToProject } from "./company-conversion-service.ts";

test("canConvertLeadToProject allows won leads that have not been converted", () => {
  assert.equal(
    canConvertLeadToProject({ stage: "WON", convertedProjectBoardId: null }),
    true
  );
});

test("canConvertLeadToProject rejects duplicate conversions", () => {
  assert.equal(
    canConvertLeadToProject({ stage: "WON", convertedProjectBoardId: "board-1" }),
    false
  );
});
```

- [ ] **Step 2: Run the conversion helper test to verify it fails**

Run: `node --test --experimental-strip-types src/lib/company-conversion-service.test.ts`

Expected: FAIL because the service does not exist yet.

- [ ] **Step 3: Implement the conversion helper and board creation logic**

Create `src/lib/company-conversion-service.ts`:

```ts
export function canConvertLeadToProject(input: {
  stage: string;
  convertedProjectBoardId: string | null;
}) {
  return input.stage === "WON" && !input.convertedProjectBoardId;
}
```

Extend `src/lib/board-service.ts` with a focused helper:

```ts
export async function createCompanyProjectBoard(input: {
  userId: string;
  companyId: string;
  sourceLeadId: string;
  title: string;
  description: string;
}) {
  return prisma.$transaction(async (tx) => {
    const board = await tx.board.create({
      data: {
        title: input.title,
        description: input.description,
        theme: "Carbon",
        tags: ["company"],
        ownerId: input.userId,
        workspaceType: "COMPANY",
        companyId: input.companyId,
        sourceLeadId: input.sourceLeadId,
      },
    });

    await tx.boardMember.create({
      data: {
        boardId: board.id,
        userId: input.userId,
        role: "OWNER",
      },
    });

    await tx.boardColumn.createMany({
      data: ["To Do", "In Progress", "Done"].map((title, index) => ({
        boardId: board.id,
        title,
        position: index,
      })),
    });

    return board;
  });
}
```

- [ ] **Step 4: Implement conversion endpoint and project list page**

Create `src/app/api/companies/[companyId]/leads/[leadId]/convert/route.ts` that:

- verifies current user owns the company
- verifies the lead is won and not yet converted
- creates a company project board
- writes the new board id to `convertedProjectBoardId`

Create `src/app/company/[companyId]/projects/page.tsx` to list company boards by `workspaceType = COMPANY` and `companyId`.

- [ ] **Step 5: Run verification**

Run:

```bash
node --test --experimental-strip-types src/lib/company-conversion-service.test.ts
npm run lint -- src/lib/company-conversion-service.ts src/lib/board-service.ts src/app/api/companies/[companyId]/leads/[leadId]/convert/route.ts src/app/company/[companyId]/projects/page.tsx
```

Expected: helper tests PASS and lint passes.

- [ ] **Step 6: Commit**

```bash
git add src/lib/company-conversion-service.ts src/lib/company-conversion-service.test.ts src/lib/board-service.ts src/app/api/companies/[companyId]/leads/[leadId]/convert/route.ts src/app/company/[companyId]/projects/page.tsx
git commit -m "feat: convert won leads into company project boards"
```

## Task 7: Add Overview Metrics, Final Authorization Pass, And Regression Verification

**Files:**
- Create: `src/lib/company-overview.ts`
- Create: `src/app/api/companies/[companyId]/overview/route.ts`
- Create: `src/app/company/[companyId]/page.tsx`
- Create: `src/components/company/overview-metrics.tsx`
- Modify: `src/lib/auth.ts`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Write the failing overview metrics test**

Replace the temporary `company-overview.test.ts` content with the final overview metric contract:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { buildCompanyOverviewMetrics } from "./company-overview.ts";

test("buildCompanyOverviewMetrics summarizes open pipeline drafts wins and active projects", () => {
  const metrics = buildCompanyOverviewMetrics({
    leads: [
      { stage: "NEW", estimatedValue: 5_000_000, wonAt: null },
      { stage: "WON", estimatedValue: 7_000_000, wonAt: new Date("2026-05-10T00:00:00.000Z") },
    ],
    quotations: [{ status: "DRAFT", total: 3_500_000 }],
    activeProjectCount: 2,
    now: new Date("2026-05-17T00:00:00.000Z"),
  });

  assert.deepEqual(metrics, {
    openPipelineValue: 5_000_000,
    quotationDraftValue: 3_500_000,
    wonValueThisMonth: 7_000_000,
    activeProjectCount: 2,
  });
});
```

- [ ] **Step 2: Run the overview metrics test to verify it fails**

Run: `node --test --experimental-strip-types src/lib/company-overview.test.ts`

Expected: FAIL because `buildCompanyOverviewMetrics` does not exist yet.

- [ ] **Step 3: Implement the metrics helper and overview endpoint**

Create `src/lib/company-overview.ts`:

```ts
import { isSameMonth } from "date-fns";

export function buildCompanyOverviewMetrics(input: {
  leads: Array<{ stage: string; estimatedValue: number; wonAt: Date | null }>;
  quotations: Array<{ status: string; total: number }>;
  activeProjectCount: number;
  now: Date;
}) {
  const openPipelineValue = input.leads
    .filter((lead) => lead.stage !== "WON" && lead.stage !== "LOST")
    .reduce((sum, lead) => sum + lead.estimatedValue, 0);

  const quotationDraftValue = input.quotations
    .filter((quotation) => quotation.status === "DRAFT")
    .reduce((sum, quotation) => sum + quotation.total, 0);

  const wonValueThisMonth = input.leads
    .filter((lead) => lead.stage === "WON" && lead.wonAt && isSameMonth(lead.wonAt, input.now))
    .reduce((sum, lead) => sum + lead.estimatedValue, 0);

  return {
    openPipelineValue,
    quotationDraftValue,
    wonValueThisMonth,
    activeProjectCount: input.activeProjectCount,
  };
}
```

Create `src/components/company/overview-metrics.tsx` to render four summary cards and `src/app/company/[companyId]/page.tsx` to fetch and display the metrics.

- [ ] **Step 4: Run full regression verification**

Run:

```bash
node --test --experimental-strip-types src/lib/company-premium.test.ts src/lib/company-auth.test.ts src/lib/validators/company.test.ts src/lib/company-quotation-service.test.ts src/lib/company-conversion-service.test.ts src/lib/company-overview.test.ts
npm run lint
npm run build
```

Expected:

- all targeted Node tests PASS
- ESLint passes for the whole repo
- Next.js production build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/lib/company-overview.ts src/lib/company-overview.test.ts src/app/api/companies/[companyId]/overview/route.ts src/app/company/[companyId]/page.tsx src/components/company/overview-metrics.tsx src/lib/auth.ts src/app/page.tsx
git commit -m "feat: finalize company overview and validation pass"
```

## Spec Coverage Check

- Premium unlock per user account: Task 1 and Task 2
- Multi-company ownership: Task 1 and Task 3
- Workspace switcher entry point: Task 2
- Dedicated dark-mode company shell: Task 3
- Company onboarding and settings: Task 3
- Lead board workflow and lead-only collaborator invites: Task 4
- Quotation numbering, revisions, and shareable detail page: Task 5
- Lead won -> company project board conversion: Task 6
- Company project listing and board reuse: Task 6
- Overview metrics: Task 7
- Regression protection for personal mode: Task 7

No spec gaps remain for the defined v1 scope.

## Placeholder And Consistency Check

- No `TODO`, `TBD`, or deferred implementation placeholders are left in task steps.
- Shared names are consistent across tasks:
  - `CompanyLead`
  - `CompanyQuotation`
  - `workspaceType`
  - `convertedProjectBoardId`
- Tests and helpers reference the same formatting rule for quotation numbers: `PREFIX/QT/YYYY/MM/NNN`.

## Notes For Execution

- Run Prisma migration generation immediately after the schema edit instead of hand-editing migration SQL if the local setup is working cleanly.
- If `npm run lint -- <file>` is not supported by the local ESLint wrapper, fall back to `npm run lint`.
- Keep the company UI components isolated under `src/components/company` rather than mixing them into existing personal-mode screens.
- If `src/app/page.tsx` becomes too large while adding the switcher, extract the home-screen company slice into `src/components/company/home-company-entry.tsx`.

Plan complete and saved to `docs/superpowers/plans/2026-05-17-company-mode-implementation.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
