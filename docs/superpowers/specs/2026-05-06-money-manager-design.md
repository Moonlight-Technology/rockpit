# Money Manager Design

Date: 2026-05-06

## Goal

Add a Money Manager feature to RockPit for daily personal finance tracking. The first version should be mobile friendly, match the existing dashboard and planner visual style, and prioritize fast transaction entry over analytics-heavy views.

Money Manager will be available from the main dashboard header beside Planner and Helicopter View, including the mobile menu.

## Scope

The first version includes:

- Multi-account money tracking for accounts such as Cash, Bank, and E-wallet.
- IDR-only amounts with Rupiah formatting.
- Income, expense, transfer, and receivable transaction flows.
- Indonesian default categories with user-created and user-edited categories.
- Monthly budget planning based on a configurable 20/30/50 template.
- Wishlist items as reminders only.
- Receivables that affect account balance when money is lent and when repayments are recorded.

The first version does not include:

- Multi-currency support.
- Automatic bank or e-wallet sync.
- Recurring transactions.
- Export/reporting.
- Negative account balances.
- Wishlist items that automatically create transactions.

## Product Approach

Use a transaction-first page at `/money-manager`.

The main screen focuses on quick entry and recent transaction history. Supporting features live in tabs or segmented navigation on the same page:

- Transactions
- Budget
- Wishlist
- Piutang
- Akun

This keeps the daily workflow fast while still making budget planning, wishlist reminders, receivables, and account management accessible.

## Navigation

Add a `Money Manager` navigation button beside `Planner` and `Helicopter View` on the main dashboard header.

On mobile, add `Money Manager` to the existing menu opened from the header menu button.

## Core Concepts

### Accounts

Users can create money accounts such as Cash, Bank, and E-wallet.

Accounts start with zero balance. Initial money must be added through an income transaction or transfer into the account.

Account balance is derived from transactions and is read-only in the account list. The transaction ledger is the source of truth.

### Transactions

Supported transaction types:

- `INCOME`: Adds money to one account.
- `EXPENSE`: Removes money from one account and belongs to a category.
- `TRANSFER`: Moves money from one account to another.
- `LEND`: Records money lent to another person and removes money from the source account.
- `RECEIVABLE_PAYMENT`: Records a repayment and adds money to the receiving account.

Transactions require a positive amount.

Expense, transfer out, and lend transactions must not make an account balance negative.

### Categories

The app provides Indonesian default categories. Users can add and edit categories.

Example defaults:

- Makan
- Transportasi
- Tagihan
- Belanja
- Kesehatan
- Hiburan
- Gaji
- Bonus
- Hadiah
- Piutang

Categories can be used by transactions and mapped into budget buckets.

Deleting a category is allowed only when it has not been used. If a category has been used, the safer behavior is to mark it inactive.

### Budget

Budget planning is monthly.

The user enters a manual monthly budget amount. If the next month is created without a new amount, the previous month's amount is used as the default.

The default template is a configurable 20/30/50 structure:

- 50% Needs
- 30% Wants
- 20% Saving & Financial Goal

Bucket labels and percentages can be edited. Bucket percentages must total 100% before the budget is applied.

Categories are assigned into buckets. Expense transactions count against the bucket that contains their category.

Budget progress shows used amount, allocated amount, and remaining amount per bucket.

### Wishlist

Wishlist is a reminder list only. It does not affect account balances or create transactions.

Wishlist items include:

- Name
- Estimated price
- Priority
- Status
- Optional notes

### Piutang

Receivables are balance-affecting records.

When the user lends money:

1. A `LEND` transaction is created.
2. The selected account balance decreases.
3. A receivable record is created with original amount and remaining amount.

When a repayment is recorded:

1. A `RECEIVABLE_PAYMENT` transaction is created.
2. The selected receiving account balance increases.
3. The receivable remaining amount decreases.
4. The receivable status updates to paid when the remaining amount reaches zero.

Repayment amount cannot exceed the remaining receivable amount.

## Data Model

Add Prisma models for the Money Manager domain. Names below are proposed implementation names.

### `MoneyAccount`

Fields:

- `id`
- `userId`
- `name`
- `type`
- `createdAt`
- `updatedAt`

Account types use an enum with these initial values: `CASH`, `BANK`, `EWALLET`, and `OTHER`.

### `MoneyCategory`

Fields:

- `id`
- `userId`
- `name`
- `kind`
- `isDefault`
- `isActive`
- `createdAt`
- `updatedAt`

`kind` can separate transaction usage such as income, expense, or both.

Default categories are copied into user-owned rows the first time the user opens Money Manager or calls the categories endpoint. This keeps category editing and budget mapping scoped to the current user.

### `MoneyTransaction`

Fields:

- `id`
- `userId`
- `type`
- `amount`
- `categoryId`
- `accountId`
- `fromAccountId`
- `toAccountId`
- `receivableId`
- `description`
- `occurredAt`
- `createdAt`
- `updatedAt`

Use `accountId` for income, expense, lend, and repayment when only one account is involved. Use `fromAccountId` and `toAccountId` for transfer. Implementation may normalize this further, but the API should keep the form behavior clear.

### `MoneyBudgetPlan`

Fields:

- `id`
- `userId`
- `month`
- `totalAmount`
- `createdAt`
- `updatedAt`

`month` should represent the budget month, normalized to the first day of the month.

### `MoneyBudgetBucket`

Fields:

- `id`
- `budgetPlanId`
- `label`
- `percentage`
- `position`
- `createdAt`
- `updatedAt`

### `MoneyBudgetBucketCategory`

Fields:

- `id`
- `bucketId`
- `categoryId`
- `createdAt`
- `updatedAt`

### `MoneyWishlistItem`

Fields:

- `id`
- `userId`
- `name`
- `estimatedPrice`
- `priority`
- `status`
- `notes`
- `createdAt`
- `updatedAt`

### `MoneyReceivable`

Fields:

- `id`
- `userId`
- `personName`
- `originalAmount`
- `remainingAmount`
- `status`
- `dueDate`
- `notes`
- `createdAt`
- `updatedAt`

### `MoneyReceivablePayment`

Fields:

- `id`
- `receivableId`
- `transactionId`
- `amount`
- `paidAt`
- `createdAt`
- `updatedAt`

## API Design

Use the existing app route style and response format.

All endpoints require an authenticated user from the session. Every query must be scoped to the current user.

Proposed endpoints:

- `/api/money/accounts`
- `/api/money/categories`
- `/api/money/transactions`
- `/api/money/budgets`
- `/api/money/wishlist`
- `/api/money/receivables`

Expected route behavior:

- Accounts: list, create, update.
- Categories: list defaults and custom categories, create, update, deactivate.
- Transactions: list by month, create income, expense, transfer, lend, and repayment transactions.
- Budgets: get or create monthly budget, update total amount, update buckets, assign categories.
- Wishlist: list, create, update status/details, delete.
- Receivables: list, create through lend transaction, record repayment, update notes/status where appropriate.

Server-side transaction creation should use a database transaction for operations that update multiple domain records, especially transfer, lend, and receivable repayment.

## UI Design

Follow the current RockPit visual style:

- Soft gray page background.
- White cards with subtle borders.
- Compact typography.
- Existing shadcn components.
- Lucide icons.
- Mobile-first layout.

### Page Structure

`/money-manager` includes:

- Header with back navigation, title, and current month context.
- Horizontal account strip with account balances and add-account affordance.
- Main tab content.
- Floating action button for quick transaction creation.

### Transactions Tab

The default tab.

Content:

- Month filter.
- Recent transactions list.
- Transaction rows with type icon, category, account, date, and amount.
- Empty state when there are no transactions.

The floating action button opens a compact action menu:

- Income
- Expense
- Transfer
- Piutang

Selecting an action opens the matching form in a modal or bottom-sheet-style panel.

### Budget Tab

Content:

- Month selector.
- Manual total monthly budget amount.
- 50/30/20 bucket cards.
- Editable bucket labels and percentages.
- Category-to-bucket assignment.
- Used, allocated, and remaining amounts per bucket.

### Wishlist Tab

Content:

- Wishlist item list.
- Estimated price.
- Priority.
- Status.
- Optional notes.

Wishlist changes do not create transactions.

### Piutang Tab

Content:

- Active and paid receivables.
- Person name.
- Original and remaining amount.
- Due date when provided.
- Payment/cicilan action.
- Payment history in detail view.

### Akun Tab

Content:

- Account list.
- Account type and derived balance.
- Create/edit account form.

Account balance is not manually editable.

## State And Data Flow

The first implementation can use a client component page, matching the current Planner pattern.

The page fetches data from API routes and stores per-tab state locally. Data should be refetched after create/update/delete actions that affect balances, budgets, or receivables.

The first implementation should refetch affected data after successful writes instead of using optimistic updates. This keeps balance, budget, and receivable totals consistent while the feature is new.

## Validation And Error Handling

Validation:

- Amounts must be greater than zero.
- Expense, transfer out, and lend cannot create negative account balance.
- Transfer source and destination accounts must be different.
- Budget bucket percentages must total 100.
- Category names cannot be empty.
- Repayment cannot exceed remaining receivable amount.
- Required form fields must be validated before submit.

Error handling:

- API errors use `{ ok: false, error: { code, message } }`.
- UI displays errors near the relevant form.
- Empty states exist for accounts, transactions, budget, wishlist, and receivables.

## Testing And Verification

Minimum verification:

- `npm run lint`
- `npm run build`

Manual QA:

- Add an account.
- Add income and confirm account balance increases.
- Add expense and confirm account balance decreases.
- Transfer money between accounts and confirm both balances change correctly.
- Create a receivable and confirm the source account decreases.
- Record a partial receivable payment and confirm receiving account and remaining amount update.
- Record final receivable payment and confirm status becomes paid.
- Create a monthly budget using the 20/30/50 template.
- Assign categories to budget buckets and confirm expense usage is reflected.
- Add wishlist items and confirm they do not affect balances.
- Confirm the dashboard navigation button works on desktop and mobile.

## Implementation Notes

Before writing code, read the relevant Next.js guide in `node_modules/next/dist/docs/` as required by the project `AGENTS.md`.

Keep implementation scoped:

- Add new Money Manager models and migrations.
- Add new API routes under `/api/money`.
- Add the new `/money-manager` page.
- Add the dashboard navigation entry.
- Avoid unrelated refactors in board, task, planner, or auth modules.
