# Client Modal Create Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Company Client creation into an Add Client modal while keeping the page focused on the client table.

**Architecture:** Keep the existing server API and table component boundary. Tighten shared Zod validation so create requires `name` and `companyName`, while update remains partial for inline edits.

**Tech Stack:** Next.js App Router, React Client Component state, Zod, Node test runner.

---

### Task 1: Require Company Name For Client Creation

**Files:**
- Modify: `src/lib/validators/company-client.test.ts`
- Modify: `src/lib/validators/company-client.ts`
- Modify: `src/lib/company-client-service.test.ts`

- [ ] **Step 1: Write failing validator and service tests**

Update create tests so name-only payloads are rejected and name plus company payloads remain valid with optional strings defaulted.

- [ ] **Step 2: Run test to verify RED**

Run: `node --test --experimental-strip-types src/lib/validators/company-client.test.ts`

Expected: FAIL because `createClientSchema.parse({ name: "Acme" })` still succeeds.

- [ ] **Step 3: Implement validator change**

Change create `companyName` to `z.string().trim().min(2).max(160)` and keep update `companyName` optional with the same minimum when present.

- [ ] **Step 4: Run tests to verify GREEN**

Run:
`node --test --experimental-strip-types src/lib/validators/company-client.test.ts`
`node --test --experimental-strip-types src/lib/company-client-service.test.ts`

Expected: PASS.

### Task 2: Move Create Form Into Modal

**Files:**
- Modify: `src/components/company/client-table.tsx`

- [ ] **Step 1: Add modal state and stricter create validity**

Add `showCreateModal`, make create valid only when `name` and `companyName` are both at least two trimmed characters, and keep inline edit validation scoped to name.

- [ ] **Step 2: Move form markup into modal**

Remove the top create card. Add a header action button in the Client list card and render a fixed overlay modal when `showCreateModal` is true.

- [ ] **Step 3: Keep create errors inside modal**

On create failure, leave the modal open and show the error inside it. On success, clear form, close modal, show page-level success message, and refresh.

- [ ] **Step 4: Verify UI code**

Run: `npx eslint src/components/company/client-table.tsx src/lib/validators/company-client.ts src/lib/validators/company-client.test.ts src/lib/company-client-service.test.ts`
Run: `npx tsc --noEmit`
Run: `npm run build`

Expected: all commands exit 0.
