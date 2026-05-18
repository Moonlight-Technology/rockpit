# Company Mode Entrypoint Design

## Goal

Simplify the home dashboard controls by replacing the current Company Mode pill cluster with one icon-only Company Mode button near the existing productivity navigation buttons.

## Current Problem

The home header currently renders Company Mode as multiple visible pills under the RockPit title:

- `Personal`
- company settings links
- `Create Company`
- owner company overview links

This makes Company Mode visually compete with the headline and creates a second navigation band. Company navigation should be available, but it should not dominate the first viewport.

## Proposed Design

Add one icon-only Company Mode button to the desktop toolbar, positioned immediately before `Planner`.

Desktop toolbar order:

- PWA install
- Company Mode icon button
- Planner
- Money Manager
- Helicopter View
- Date badge
- Sign Out

The button uses a company-oriented lucide icon such as `Building2` or `BriefcaseBusiness`, with `aria-label="Company Mode"` and a tooltip/title. The visible text label is omitted to keep the toolbar compact.

## Locked Behavior

When the account has not unlocked Company Mode and has no company collaborator access, clicking the icon button opens the existing `CompanyUnlockDialog`.

The locked icon may use a subtle amber outline or indicator so users can tell that the feature is gated without adding text.

## Unlocked Behavior

When Company Mode is available, clicking the icon button opens a small popover/card anchored under the button.

Popover content:

- Header: `Company Mode`
- Owner companies:
  - Company name
  - `Overview` action
  - `Settings` action
- Collaborator companies:
  - Company name
  - `Leads` action
- Footer action: `Create Company`

Selecting an action closes the popover and navigates to the target route.

Route rules:

- Owner overview: `/company/[companyId]`
- Owner settings: `/company/[companyId]/settings`
- Collaborator leads: `/company/[companyId]/leads`
- Create company: `/company/new/settings`

## Mobile Behavior

The existing mobile menu gets one `Company Mode` item after `PwaInstallButton`.

Locked mobile behavior opens the unlock dialog.

Unlocked mobile behavior renders the company actions directly inside the mobile menu as a compact nested section. It should not open a second popover inside the mobile menu.

## Removed UI

Remove `CompanySwitcher` from under the RockPit headline.

Remove the separate owner-company overview link row from under the headline.

The headline area should only show:

- `RockPit`
- the subtitle
- the mobile date text

## Component Boundary

Replace `CompanySwitcher` with a focused component, tentatively named `CompanyModeMenu`, responsible only for:

- rendering the icon button
- deciding locked vs unlocked click behavior
- rendering the company popover/menu
- routing selected company actions

The home page remains responsible for loading `companies`, `hasCompanyMode`, and showing `CompanyUnlockDialog`.

## Error Handling

If company state fails to load, the button behaves as locked and opens the unlock dialog. This matches the existing conservative fallback.

If there are no companies after unlock, the popover shows only `Create Company`.

## Testing

Add focused tests where practical for pure helpers if route option generation is extracted.

Run:

- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`

Manual QA:

- locked state opens unlock dialog
- unlocked owner state opens popover with Overview, Settings, Create Company
- collaborator state opens popover/menu with Leads
- mobile menu shows Company Mode actions without the old pill cluster

## Out Of Scope

- Redesigning the whole dashboard header.
- Changing Company Mode authorization.
- Changing company CRUD.
- Changing Planner, Money Manager, or Helicopter View behavior.
