# Company Client Management Design

## Goal

Company Mode needs a dedicated Client menu where the company owner can manage client master data in a table. Leads must be created from existing client records so the pipeline does not collect duplicated or inconsistent prospect names.

## Scope

This feature adds client CRUD for company owners, connects leads to clients, and updates lead creation so a lead chooses a client from company-owned client data. Collaborators keep their current lead board access but do not manage clients.

## Data Model

Add a `CompanyClient` model related to `Company` and `CompanyLead`.

Fields:

- `id`
- `companyId`
- `name`
- `email`
- `phone`
- `companyName`
- `address`
- `notes`
- `createdAt`
- `updatedAt`

Add `clientId` to `CompanyLead`. New leads must provide a valid `clientId` from the same company. `prospectName` remains on `CompanyLead` for existing data and display compatibility; when a new lead is created, it is set from the selected client's `name`.

Deleting a client is only allowed when it is not referenced by any lead. This avoids orphaned lead history and keeps existing quotations and project conversion behavior stable.

## Navigation

The Company Mode sidebar adds a `Client` item under `Workspace`, before `Leads`.

Owner navigation:

- Overview
- Client
- Leads
- Projects
- Quotations
- Settings

Collaborator navigation remains limited to shared lead access and does not include Client.

## Client Page

Route: `/company/[companyId]/clients`

The page is owner-only. It renders a table with these columns:

- Name
- Company
- Email
- Phone
- Notes
- Updated
- Actions

The page supports:

- Create client
- Edit client
- Delete client when unused
- Empty state when no clients exist
- Inline feedback for validation and API errors

The UI follows the current Company Mode style: restrained cards, shadcn table primitives, lucide icons for actions, and compact forms suitable for repeated operations.

## Lead Creation Flow

The create lead form replaces the free-text `Prospect` input with a client selector. The selector is populated from company clients and sends `clientId` in the create lead payload.

Lead creation validates:

- The current user owns the company.
- The selected column belongs to the company's primary lead board.
- The selected client belongs to the same company.
- Title and estimated value remain valid under the existing lead rules.

After creation, the lead card continues to display the client name in the same visual position where `prospectName` appears today.

If no clients exist, the lead form shows an actionable empty state that points the owner to create a client first.

## API And Services

Add `src/lib/company-client-service.ts` with owner-only operations:

- `listClientsForUser`
- `createClientForUser`
- `updateClientForUser`
- `deleteClientForUser`

Add `src/lib/validators/company-client.ts` with Zod schemas for create and update payloads.

Add route handlers:

- `GET /api/companies/[companyId]/clients`
- `POST /api/companies/[companyId]/clients`
- `PATCH /api/companies/[companyId]/clients/[clientId]`
- `DELETE /api/companies/[companyId]/clients/[clientId]`

Update `createLeadForUser` and `createLeadSchema` so new lead creation requires `clientId` instead of `prospectName`. The service looks up the client and copies `client.name` into `prospectName`.

## Migration

The migration adds `CompanyClient` and nullable `CompanyLead.clientId`. It does not backfill existing leads automatically because existing `prospectName` values may not map cleanly to a unique client.

After migration:

- Existing leads remain visible and usable through `prospectName`.
- New leads require `clientId`.
- Future cleanup can optionally backfill old leads once duplicate handling rules are decided.

## Error Handling

Client API errors use the existing response helpers:

- `401` for unauthenticated access
- `403` for non-owner access
- `404` for missing company or client
- `422` for invalid payloads or deleting a client that is already used by a lead

Lead creation returns `422` when the selected client is invalid for the company.

## Testing

Add focused tests for:

- Client validator normalization and required fields.
- Client service owner-only create, update, and delete behavior.
- Delete rejection when a client has leads.
- Lead creation requiring a valid `clientId`.
- Lead creation rejecting a client from another company.

Run the existing lint and relevant Node test files after implementation.

## Out Of Scope

- Client import/export.
- Client search across multiple companies.
- Automatic backfill of existing leads.
- Collaborator client management.
- Converting a client into an invoice or quotation recipient profile beyond the existing lead relationship.
