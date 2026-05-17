# Company Mode Design

Date: 2026-05-17
Status: Proposed

## Summary

`Company Mode` is a premium workspace layer for business operations inside the existing app. It reuses the current backend foundation for boards and tasks, but introduces a distinct premium experience with its own dark-mode shell, company-specific modules, and a user-level unlock flow.

The first release targets an end-to-end business workflow:

- permanent premium unlock per user account using a key code
- multiple companies per premium owner
- company onboarding and profile management
- lead pipeline management in a dedicated lead board
- quotation management with automatic company-based numbering
- conversion from won lead into a company project board
- restricted collaborator access to invited lead boards or project boards only

This is intentionally not a generic multi-tenant workspace platform in v1. The design extends the current user-centric architecture with a bounded `Company Mode` domain while reusing the existing board engine where it already fits.

## Goals

- Add a premium `Company Mode` experience without breaking existing personal workflows.
- Make the premium area feel meaningfully different through a dedicated dark-mode UI shell.
- Support one premium user owning multiple companies.
- Support a sales-to-delivery flow: lead -> quotation revisions -> deal won -> project board.
- Reuse the current board/task engine for delivery projects instead of building a second project system.
- Allow non-premium collaborators to work on invited lead boards and project boards without unlocking premium.

## Non-Goals For V1

- Full company-wide RBAC with many roles and permission matrices.
- Automatic premium access for invited collaborators.
- PDF generation for quotation documents.
- Invoicing, payments, or accounting workflows.
- CRM analytics beyond essential overview metrics.
- A full generic workspace refactor that unifies personal and company modes at every layer.

## Product Model

The app will have two operating contexts:

- `Personal Mode`: the current personal productivity workspace
- `Company Mode`: a premium business workspace owned by a premium user

The entry point remains the main home area, but a workspace switcher is added so the user can switch between:

- personal workspace
- owned companies

When the user selects a company, the app opens a dedicated `Company Mode` shell with a full dark-mode dashboard experience. The user should perceive this as a premium business control center, even though the backend still reuses the existing app foundation where appropriate.

## Premium Unlock

### Unlock Rule

- Unlock is per user account.
- Unlock is permanent once the valid key is submitted.
- The v1 unlock key is `MAMAT-METAL`.

### User Experience

- Users see `Company Mode` as a premium destination in the workspace switcher.
- If the user has not unlocked premium, opening `Company Mode` prompts for the key.
- On successful validation, the account is marked as premium-unlocked and the user can create or access companies.

### Security Notes

- The unlock check should not expose the key in client-side logic.
- Invalid attempts should return a generic invalid-code response.
- The server should persist the premium status on the user account or a dedicated unlock record.

## Core V1 Decisions

- Premium unlock applies per user account, not per device and not per company.
- A premium owner can create and manage multiple companies.
- Invited collaborators do not automatically unlock premium.
- Collaborators can access only the lead boards or project boards they are explicitly invited to.
- A lead can have multiple quotation revisions.
- A lead can be converted into exactly one project board after it is won.
- Quotation numbering uses a company-specific prefix.
- `Company Mode` is entered through a workspace switcher in the main app, not as a separate app root.

## Information Architecture

The `Company Mode` shell should have a dedicated dark UI based on a shadcn dashboard-style experience, with a separate layout and navigation from personal mode.

Primary sections:

- `Overview`
- `Leads`
- `Quotations`
- `Projects`
- `Settings`

### Overview

The overview page is the company control center. It should summarize:

- total open pipeline value
- quotation value in progress
- won deals for the current period
- active project count
- quick links into leads, quotations, and projects

### Leads

The leads area is a dedicated kanban-style sales board for marketing and sales work.

Each lead should support:

- prospect or client name
- lead title
- estimated value
- stage
- owner
- notes
- timestamps

Leads live in a distinct `lead board` resource, separate from delivery project boards.

### Quotations

The quotations area manages all quotations across the selected company.

Each quotation belongs to a lead and supports:

- automatic quotation number based on the company prefix
- revision history
- status
- line items
- total value
- a shareable or printable detail page

V1 supports a rendered quotation detail page suitable for sharing or printing from the browser. PDF export is deferred.

### Projects

The projects area is powered by the current board engine.

When a lead becomes won:

- the lead is converted into a new company project board
- the project board is linked back to the source lead
- project execution continues using the existing board and task behavior

This keeps the existing project board capability intact while aligning it with the company workflow.

### Settings

V1 settings focus on foundational company data:

- company name
- company description or profile
- company business field, defaulting to `jasa`
- quotation prefix
- future-editable company information

## Workflow Design

### 1. Premium Unlock

- User chooses `Company Mode` from the workspace switcher.
- If locked, the app opens a premium unlock prompt.
- User submits the key code.
- On success, the account gains permanent premium access.

### 2. Company Creation

If the user has no companies yet, the app launches onboarding:

- company name
- business field
- quotation prefix
- basic company information

The owner can add more detailed information later.

### 3. Lead Management

Inside the selected company:

- the owner creates and manages leads in a dedicated kanban board
- each lead contains value estimation and sales context
- leads move through configurable or predefined stages

### 4. Quotation Creation And Revision

From a lead:

- the owner creates a quotation
- the system assigns an automatic number using the company prefix
- future revisions create new quotation revisions rather than overwriting history

This preserves the audit trail and reflects real sales iteration.

### 5. Deal Conversion

Once a lead is won:

- the lead is marked as won
- the system allows exactly one conversion into a project board
- a new company project board is created using the existing board engine
- the board is linked to the company and the source lead

### 6. Delivery Execution

The resulting project board behaves like the current board system:

- columns
- tasks
- assignees
- timeline and calendar views
- project info and notes

The main difference is that the board is now marked as a company project and is reachable from `Company Mode`.

## Access Model

### Company Owner

The premium owner can:

- unlock premium
- create multiple companies
- access all sections of owned companies
- create and manage leads
- create and manage quotations
- convert won leads into projects
- manage company settings
- invite collaborators to specific resources

### Invited Collaborator

The invited collaborator:

- does not receive premium unlock automatically
- does not get company-wide access
- can access only the lead boards or project boards they are invited to
- cannot access the full `Company Mode` shell
- cannot access global quotation lists or company settings in v1

### Authorization Strategy

V1 should keep authorization intentionally simple:

- owner-level access for company-wide actions
- resource-level invitation access for specific lead boards and project boards

Avoid introducing full RBAC in v1. The current app already has board membership concepts, so the design should stay close to that model.

## Data Model

The current `User`, `Board`, and `Task` foundation remains in place. `Company Mode` adds new entities around it.

### New Entities

#### `UserPremiumUnlock`

Purpose:

- persist whether a user has permanently unlocked premium

Suggested fields:

- `id`
- `userId`
- `unlockedAt`
- `unlockSource`

This can also be collapsed into a field on `User` if a separate table feels unnecessary, but a dedicated record is cleaner if future premium states expand.

#### `Company`

Purpose:

- represent a company owned by a premium user

Suggested fields:

- `id`
- `ownerId`
- `name`
- `slug`
- `description`
- `businessType`
- `quotationPrefix`
- `createdAt`
- `updatedAt`

#### `CompanyLeadBoard`

Purpose:

- represent a company-specific lead board

Suggested fields:

- `id`
- `companyId`
- `name`
- `description`
- `createdAt`
- `updatedAt`

This gives space for more than one lead board per company in the future, even if v1 starts with one primary board.

#### `CompanyLeadColumn`

Purpose:

- define kanban stages for a company lead board

Suggested fields:

- `id`
- `leadBoardId`
- `title`
- `position`

#### `CompanyLead`

Purpose:

- represent an individual lead card in the pipeline

Suggested fields:

- `id`
- `companyId`
- `leadBoardId`
- `columnId`
- `title`
- `prospectName`
- `estimatedValue`
- `ownerUserId`
- `notes`
- `wonAt`
- `convertedProjectBoardId`
- `createdAt`
- `updatedAt`

The presence of `convertedProjectBoardId` makes the exactly-once conversion rule enforceable.

#### `CompanyQuotation`

Purpose:

- represent a quotation revision linked to a lead

Suggested fields:

- `id`
- `companyId`
- `leadId`
- `quotationNumber`
- `revisionNumber`
- `status`
- `subtotal`
- `total`
- `issuedAt`
- `createdByUserId`
- `createdAt`
- `updatedAt`

#### `CompanyQuotationLine`

Purpose:

- store the line items for a quotation

Suggested fields:

- `id`
- `quotationId`
- `description`
- `quantity`
- `unitPrice`
- `lineTotal`
- `position`

### Existing Entity Extensions

#### `Board`

The current `Board` model should be extended rather than replaced.

Suggested additions:

- `companyId?`
- `sourceLeadId?`
- `workspaceType` with values such as `PERSONAL` and `COMPANY`

These fields allow the app to:

- distinguish personal boards from company boards
- link a delivery board to the owning company
- trace the sales origin of the project

## Why Separate Lead Boards From Project Boards

This is a deliberate product boundary and should remain explicit.

Lead boards and project boards are different resources because:

- sales work and delivery work have different states and behaviors
- sales history should not be rewritten into a delivery board
- a won lead should create a new operational context for execution
- access rules can remain cleaner when sales and delivery are not conflated

The result:

- lead board remains a sales pipeline artifact
- project board remains an execution artifact

## UI Direction

The company experience should feel premium and distinct without forking the entire backend.

V1 UI direction:

- dark-mode shell specific to `Company Mode`
- shadcn dashboard-style layout
- different navigation and visual treatment from personal mode
- preserved personal mode styling for existing screens

The important constraint is separation of user perception, not duplication of business logic. Users should feel they entered a business operating system, even though project execution still relies on the existing board foundation.

## Error Handling

V1 should explicitly handle these cases:

- invalid premium code
- non-premium user attempting to open a company shell
- user attempting to access a company they do not own
- collaborator opening a company-only page without permission
- duplicate or invalid quotation prefix during setup
- quotation number collision
- attempted second conversion of the same lead into another project
- missing or deleted linked resources

Recommended behaviors:

- use `forbidden` or `not found` responses for unauthorized company-level access
- return validation errors for malformed company setup and quotation data
- enforce conversion uniqueness at the database level where practical

## Testing Strategy

Priority test coverage should include:

- premium unlock persistence per user
- premium gating behavior in the workspace switcher
- multi-company creation and switching
- owner authorization for company-wide routes and actions
- collaborator authorization for invited lead boards and project boards
- quotation numbering uniqueness within a company
- quotation revision creation from one lead
- exactly-once lead conversion to project board
- regression coverage for existing personal boards and tasks

## Incremental Implementation Strategy

Recommended delivery order:

1. Premium unlock persistence and server-side validation
2. Company entity, company creation flow, and workspace switcher
3. Dedicated `Company Mode` dark shell and company navigation
4. Lead board module
5. Quotation module, numbering, revision handling, and shareable detail page
6. Lead won -> company project board conversion
7. Resource-level invitation model for lead boards and company project boards
8. Overview metrics and polish

This order reduces risk by introducing company identity and access first, then layering business workflows on top.

## Future Development Suggestions

These are intentionally out of scope for v1, but worth capturing now so the data model and UI do not corner us later.

### Client Directory

Separate long-lived clients from raw leads, so one client can have multiple leads, quotations, and projects over time.

### Activity Timeline

Add timeline logging to leads, quotations, and project conversion events for auditability and team collaboration.

### Internal Roles

Introduce company-scoped roles such as:

- sales
- operations
- finance
- admin

This should happen only after the simpler owner-plus-resource-invite model is proven.

### Financial Follow-Through

Extend from quotation to:

- invoice
- payment tracking
- collection status

### Forecasting

Add monthly and quarterly forecast views driven by pipeline and quotation status.

### Richer Document System

Upgrade quotation output from a printable detail page to branded PDF generation and document templates.

### Shared Company Center For Collaborators

If the product later needs broader teamwork, add a restricted collaborator-facing company shell instead of only board-level entry points.

## Recommended Approach

Use the existing backend and board engine as the foundation, then build `Company Mode` as a bounded product extension with its own premium UI shell and new sales-domain entities.

This balances speed, maintainability, and user perception:

- speed because the board engine is reused
- maintainability because the system is extended, not hard-forked
- premium perception because the company shell and visuals are intentionally distinct

## Open Questions Deferred Beyond V1

The following are intentionally deferred and do not block the first implementation plan:

- whether lead stages are fully customizable in v1 or seeded with defaults only
- whether a company can have multiple lead boards immediately or starts with one visible board while keeping the schema flexible
- whether quotations later support approval workflows before sharing
- whether company collaborators eventually get their own scoped dashboard

These do not need to be solved now as long as the design leaves room for them.
