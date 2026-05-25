# Company Expense Manager Design

Date: 2026-05-25
Status: Proposed

## Summary

Add `Expense Manager` as an owner-only module inside `Company Mode`. The feature set matches the existing personal `Money Manager`, but ownership moves from `userId` to `companyId` and the entry point lives only in the company sidebar.

This release should prioritize safe reuse over a large refactor. The personal money feature remains intact. Company expense data uses its own API namespace, its own authorization checks, and a route under the company workspace shell.

## Goals

- Add a company-scoped finance workspace with parity to the current `Money Manager` feature set.
- Keep the entry point inside the company sidebar only.
- Restrict access to company owners only.
- Reuse as much UI and calculation logic as practical without destabilizing the existing personal money flows.

## Non-Goals

- Adding `Expense Manager` to the personal dashboard, mobile launcher, or company dropdown menu.
- Supporting collaborator access in v1.
- Building a generic multi-scope finance platform that unifies personal and company storage in one refactor.
- Adding accounting reports, invoicing, bank sync, or approval workflows.

## Product Decision

`Expense Manager` is a new company workspace page at:

- `/company/[companyId]/expenses`

It appears only in the owner-visible company sidebar beside the existing company modules. It does not appear in:

- the personal home page
- the mobile/personal `Company Mode` popup menu
- collaborator navigation

## Access Model

### Owner

The company owner can:

- open the `Expense Manager` page
- read and mutate all expense data for that company
- create accounts, categories, transactions, budgets, wishlist items, and receivable payments

### Collaborator

Collaborators cannot:

- see the `Expense Manager` navigation item
- open `/company/[companyId]/expenses`
- call company expense APIs successfully

### Authorization Rule

Every company expense route and service path must verify:

- the session user exists
- the session user owns the target company

If either check fails, return the same denial behavior used by owner-only company features for this codebase.

## Feature Scope

Company `Expense Manager` matches the current personal `Money Manager` behavior:

- multi-account balance tracking
- company-owned categories
- transaction entry for `INCOME`, `EXPENSE`, `TRANSFER`, `LEND`, and `RECEIVABLE_PAYMENT`
- monthly budget planning with buckets and category mapping
- wishlist tracking
- receivable tracking and repayment recording

The functional difference is ownership scope only:

- personal money records belong to a `user`
- company expense records belong to a `company`

## Information Architecture

### Sidebar

Add `Expense Manager` to the owner section of the company sidebar in `CompanyShell`.

Placement should follow the current company navigation style and sit with other workspace modules, not under admin settings.

### Page

The page lives inside the existing company shell:

- route: `/company/[companyId]/expenses`
- label: `Expense Manager`

The visual structure should remain familiar to the current `Money Manager` page so users do not need to relearn the workflow.

## Technical Approach

Recommended approach: reuse UI patterns and pure calculations, but keep company backend routes and storage separate from the existing personal endpoints.

Why:

- `src/app/money-manager/page.tsx` is currently a large client page with hard-coded personal endpoints.
- `src/lib/money.ts` is currently user-scoped and tightly coupled to `userId`.
- a forced unification now would widen risk across existing personal finance flows.

This means v1 should:

- extract reusable UI or helper pieces only where doing so is low-risk
- reuse pure calculation helpers where they are scope-agnostic
- add dedicated company expense service functions and route handlers
- keep personal `/api/money/*` routes unchanged

## Data Model

Add company-owned counterparts for the money domain in Prisma.

Expected model families:

- `CompanyMoneyAccount`
- `CompanyMoneyCategory`
- `CompanyMoneyTransaction`
- `CompanyMoneyBudgetPlan`
- `CompanyMoneyBudgetBucket`
- `CompanyMoneyWishlistItem`
- `CompanyMoneyReceivable`
- `CompanyMoneyReceivablePayment`

Expected relationship pattern:

- each record references `companyId`
- each record is deleted when the company is deleted
- transactions reference company accounts/categories/receivables within the same company

Enums can be reused where the values are identical:

- `MoneyAccountType`
- `MoneyCategoryKind`
- `MoneyTransactionType`
- `MoneyWishlistPriority`
- `MoneyWishlistStatus`
- `MoneyReceivableStatus`

Default category seeding should happen per company, not per user.

## API Design

Create a company-scoped API namespace under:

- `/api/companies/[companyId]/money/accounts`
- `/api/companies/[companyId]/money/categories`
- `/api/companies/[companyId]/money/transactions`
- `/api/companies/[companyId]/money/transactions/[id]`
- `/api/companies/[companyId]/money/budgets`
- `/api/companies/[companyId]/money/wishlist`
- `/api/companies/[companyId]/money/receivables`

The request and response shapes should mirror the existing personal money API whenever possible so the page logic can be reused with minimal branching.

Because this codebase uses the current Next.js route handler behavior, dynamic route `params` must follow the project’s promise-based pattern used in the current app router files.

## Service Layer

Add a dedicated company expense service module instead of extending the current personal money service in place.

Responsibilities:

- verify company ownership context
- seed default categories for a company
- perform CRUD operations for company finance records
- map Prisma records into the same DTO shape expected by the UI

Pure calculation helpers should remain shared if they do not depend on ownership scope.

## UI Reuse Strategy

The current `Money Manager` page should be mined for reusable parts only where it reduces duplication without creating a broad refactor.

Good extraction candidates:

- data type declarations shared by page and service responses
- formatting helpers
- tab or card subcomponents with no personal-route assumptions

Avoid unnecessary abstraction if it makes the page harder to reason about. A little duplication is acceptable in v1 if it keeps the boundary between personal and company code explicit.

## Navigation And Shell Behavior

- `CompanyShell` shows `Expense Manager` only when `canManageSettings` is true.
- collaborator company shells do not render the nav item.
- the active-nav helper should treat `/company/[companyId]/expenses` like other company sections.

## Error Handling

- unauthorized owner checks should fail before any company finance data is returned
- invalid payloads should reuse the existing API validation response style
- partial company expense load failures should show a user-facing error state similar to the current money page
- data creation and updates should preserve the current optimistic-free, refetch-after-write pattern

## Testing

Add coverage in these layers:

- validator tests for company expense payloads if separate schemas are introduced
- pure helper tests for any new shared calculations
- service tests for owner access, default category seeding, transaction flows, budgets, wishlist, and receivables
- navigation tests to confirm owner-only sidebar visibility and active state

Critical behavior to verify:

- owners can open the page and read/write company expense data
- collaborators cannot see the nav item and cannot access APIs
- company data is isolated between companies
- personal money data is unaffected
- company default categories seed once per company
- transfer, lend, and receivable payment flows update balances correctly

## Rollout Notes

This feature should ship as a bounded addition to `Company Mode`, not as a finance-platform refactor. If future work needs collaborator permissions or unified personal/company money internals, that should happen in a separate design cycle after this owner-only version is stable.
