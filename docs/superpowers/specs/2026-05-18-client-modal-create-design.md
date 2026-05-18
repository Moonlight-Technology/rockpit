# Client Modal Create Design

## Goal

Clean up the Company Client page so it presents the client table as the primary surface and moves new-client creation into a modal.

## Current Problem

The Client page currently renders a full create form above the table. This makes the page feel form-first even though client management is mostly a table workflow.

## Proposed Design

Use one table card for the page content. The card header contains:

- Title: `Client list`
- Description/count text
- Primary action: `Add client`

Clicking `Add client` opens a modal overlay with the create form.

## Create Modal

The modal form fields are:

- `Name *`
- `Company *`
- `Email`
- `Phone`
- `Address`
- `Notes`

Required fields:

- `name`
- `companyName`

Optional fields:

- `email`
- `phone`
- `address`
- `notes`

Submit is disabled until `name` and `companyName` both contain valid non-empty values. On successful create, the modal closes, the form resets, the page refreshes, and a success message can remain visible on the table page.

## Table Behavior

The table remains the main view. Inline edit stays unchanged for now, because it supports fast corrections without expanding scope.

The empty state remains inside the table card and includes an `Add client` action that opens the same modal.

## Validation

Update the client create validator so `companyName` is required with a minimum length of 2 characters. Keep optional fields optional.

Update the client update validator so `companyName`, when provided, must also be at least 2 characters. Existing clients can still be updated partially as long as at least one field is provided.

## Error Handling

Modal-level validation errors appear near the modal submit area. API errors from create remain visible in the modal.

Table-level update and delete errors remain visible in the table card.

## Testing

Update focused validator tests to confirm:

- create rejects missing `companyName`
- create accepts `name` and `companyName` with optional fields omitted
- update rejects empty payload
- update accepts partial optional updates

Run:

- `node --test --experimental-strip-types src/lib/validators/company-client.test.ts`
- `node --test --experimental-strip-types src/lib/company-client-service.test.ts`
- `npx tsc --noEmit`
- targeted lint for changed files
- `npm run build`

Manual QA:

- Client page shows table-only content by default.
- `Add client` opens modal.
- Submit is disabled until name and company are filled.
- Create success closes modal and refreshes the table.
- Empty state `Add client` opens the same modal.

## Out Of Scope

- Moving edit into a modal.
- Changing delete behavior.
- Adding search, sorting, or pagination.
- Changing lead creation behavior.
