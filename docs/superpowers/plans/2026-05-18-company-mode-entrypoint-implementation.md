# Company Mode Entrypoint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Company Mode pill cluster on the home dashboard with one icon-only Company Mode menu button placed before Planner.

**Architecture:** Move Company Mode navigation into a focused client component that owns only the icon button, unlocked popover, and mobile menu section. Keep `src/app/page.tsx` responsible for fetching company state and showing `CompanyUnlockDialog`, while removing the old headline pills and owner overview row.

**Tech Stack:** Next.js 16 App Router, React 19 client components, TypeScript, Tailwind/shadcn UI primitives, lucide-react, Node 22 `node --test --experimental-strip-types`, ESLint.

---

## Context And Constraints

- The relevant Next.js 16 docs for client/server boundaries and layouts were already reviewed from `node_modules/next/dist/docs/`.
- `src/app/page.tsx` is a large client component. Keep this change narrow: replace Company Mode controls only.
- Do not change Company Mode authorization, unlock API, company CRUD, Planner, Money Manager, or Helicopter View behavior.
- The user declined browser visual companion and will manually test the rendered UI.
- Use `apply_patch` for code edits.

## File Map

- Create `src/components/company/company-mode-menu.tsx`: icon-only Company Mode button, desktop popover, and mobile menu section.
- Modify `src/app/page.tsx`: replace `CompanySwitcher` usage with `CompanyModeMenu`, remove owner overview row, add the desktop button before Planner and the mobile section after `PwaInstallButton`.
- Optionally leave `src/components/company/company-switcher.tsx` in place if unused cleanup is not needed for this change.

## Task 1: Add Company Mode Menu Component

**Files:**
- Create: `src/components/company/company-mode-menu.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/company/company-mode-menu.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, ChevronRight, Plus, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type CompanyModeMenuCompany = {
  id: string;
  name: string;
  access: "OWNER" | "COLLABORATOR";
};

type CompanyModeMenuProps = {
  hasCompanyMode: boolean;
  companies: CompanyModeMenuCompany[];
  onOpenLockedMode: () => void;
  mobile?: boolean;
  onNavigate?: () => void;
};

function ownerOverviewHref(companyId: string) {
  return `/company/${companyId}`;
}

function ownerSettingsHref(companyId: string) {
  return `/company/${companyId}/settings`;
}

function collaboratorLeadsHref(companyId: string) {
  return `/company/${companyId}/leads`;
}

export function CompanyModeMenu({
  hasCompanyMode,
  companies,
  onOpenLockedMode,
  mobile = false,
  onNavigate,
}: CompanyModeMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ownerCompanies = companies.filter((company) => company.access === "OWNER");
  const collaboratorCompanies = companies.filter((company) => company.access === "COLLABORATOR");
  const canOpenCompanyMenu = hasCompanyMode || companies.length > 0;

  function navigate(href: string) {
    setOpen(false);
    onNavigate?.();
    router.push(href);
  }

  function handleButtonClick() {
    if (!canOpenCompanyMenu) {
      onOpenLockedMode();
      return;
    }

    setOpen((current) => !current);
  }

  if (mobile) {
    return (
      <div className="flex flex-col gap-1 border-b border-border pb-2">
        <Button
          size="sm"
          variant="ghost"
          className="w-full justify-start"
          onClick={() => {
            if (!canOpenCompanyMenu) {
              onNavigate?.();
              onOpenLockedMode();
              return;
            }
            setOpen((current) => !current);
          }}
        >
          <Building2 data-icon="inline-start" />
          Company Mode
        </Button>

        {canOpenCompanyMenu && open ? (
          <div className="ml-3 flex flex-col gap-1 border-l border-border pl-2">
            {ownerCompanies.map((company) => (
              <div key={company.id} className="rounded-lg bg-muted/40 p-2">
                <p className="truncate text-xs font-medium text-foreground">{company.name}</p>
                <div className="mt-1 grid grid-cols-2 gap-1">
                  <Button
                    size="xs"
                    variant="ghost"
                    className="justify-start"
                    onClick={() => navigate(ownerOverviewHref(company.id))}
                  >
                    Overview
                  </Button>
                  <Button
                    size="xs"
                    variant="ghost"
                    className="justify-start"
                    onClick={() => navigate(ownerSettingsHref(company.id))}
                  >
                    Settings
                  </Button>
                </div>
              </div>
            ))}
            {collaboratorCompanies.map((company) => (
              <Button
                key={company.id}
                size="xs"
                variant="ghost"
                className="justify-start"
                onClick={() => navigate(collaboratorLeadsHref(company.id))}
              >
                {company.name} Leads
              </Button>
            ))}
            {hasCompanyMode ? (
              <Button
                size="xs"
                variant="ghost"
                className="justify-start"
                onClick={() => navigate("/company/new/settings")}
              >
                <Plus data-icon="inline-start" />
                Create Company
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="relative">
      <Button
        size="icon-sm"
        variant="outline"
        aria-label="Company Mode"
        title="Company Mode"
        aria-expanded={open}
        onClick={handleButtonClick}
        className={
          canOpenCompanyMenu
            ? ""
            : "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
        }
      >
        <Building2 />
      </Button>

      {canOpenCompanyMenu && open ? (
        <>
          <button
            type="button"
            aria-label="Close Company Mode menu"
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setOpen(false)}
          />
          <Card className="absolute right-0 top-9 z-40 w-72 shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Company Mode</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-2 pt-0">
              {ownerCompanies.map((company) => (
                <div key={company.id} className="rounded-lg border border-border bg-muted/30 p-2">
                  <p className="truncate text-sm font-medium text-foreground">{company.name}</p>
                  <div className="mt-2 grid grid-cols-2 gap-1">
                    <Button
                      size="xs"
                      variant="ghost"
                      className="justify-start"
                      onClick={() => navigate(ownerOverviewHref(company.id))}
                    >
                      <ChevronRight data-icon="inline-start" />
                      Overview
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      className="justify-start"
                      onClick={() => navigate(ownerSettingsHref(company.id))}
                    >
                      <Settings data-icon="inline-start" />
                      Settings
                    </Button>
                  </div>
                </div>
              ))}

              {collaboratorCompanies.map((company) => (
                <Button
                  key={company.id}
                  size="sm"
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => navigate(collaboratorLeadsHref(company.id))}
                >
                  <ChevronRight data-icon="inline-start" />
                  {company.name} Leads
                </Button>
              ))}

              {hasCompanyMode ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => navigate("/company/new/settings")}
                >
                  <Plus data-icon="inline-start" />
                  Create Company
                </Button>
              ) : null}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Run typecheck and expect import-only success**

Run: `npx tsc --noEmit`

Expected: PASS or only unrelated existing errors. The component is not wired yet, so there should be no runtime behavior change.

## Task 2: Wire Desktop And Mobile Home Header

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Replace imports**

In `src/app/page.tsx`, remove:

```ts
import Link from "next/link";
import { CompanySwitcher } from "@/components/company/company-switcher";
```

Add:

```ts
import { CompanyModeMenu } from "@/components/company/company-mode-menu";
```

Keep `Link` only if another remaining part of the file still uses it. If no usage remains, remove it.

- [ ] **Step 2: Remove ownerCompanies memo**

Delete this block:

```ts
const ownerCompanies = useMemo(
  () => companies.filter((company) => company.access === "OWNER"),
  [companies]
);
```

- [ ] **Step 3: Remove headline CompanySwitcher UI**

Delete this JSX under the subtitle:

```tsx
<CompanySwitcher
  hasCompanyMode={hasCompanyMode}
  companies={companies}
  onOpenLockedMode={() => setShowCompanyUnlockDialog(true)}
/>
{ownerCompanies.length > 0 ? (
  <div className="flex flex-wrap items-center gap-2 pt-1">
    {ownerCompanies.map((company) => (
      <Link
        key={company.id}
        href={`/company/${company.id}`}
        className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-medium text-cyan-900 transition hover:border-cyan-300 hover:bg-cyan-100"
      >
        {company.name} Overview
      </Link>
    ))}
  </div>
) : null}
```

- [ ] **Step 4: Add desktop icon button before Planner**

In the desktop toolbar, immediately after `<PwaInstallButton />`, add:

```tsx
<CompanyModeMenu
  hasCompanyMode={hasCompanyMode}
  companies={companies}
  onOpenLockedMode={() => setShowCompanyUnlockDialog(true)}
/>
```

- [ ] **Step 5: Add mobile Company Mode section**

In the mobile menu card, immediately after `<PwaInstallButton />`, add:

```tsx
<CompanyModeMenu
  mobile
  hasCompanyMode={hasCompanyMode}
  companies={companies}
  onOpenLockedMode={() => setShowCompanyUnlockDialog(true)}
  onNavigate={() => setShowMobileMenu(false)}
/>
```

- [ ] **Step 6: Run typecheck**

Run: `npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 7: Commit header wiring**

```bash
git add src/components/company/company-mode-menu.tsx src/app/page.tsx
git commit -m "feat: simplify company mode entrypoint"
```

## Task 3: Verification

**Files:**
- Read-only verification.

- [ ] **Step 1: Run focused static verification**

Run:

```bash
npx tsc --noEmit
npm run lint
```

Expected:

- TypeScript exits `0`.
- ESLint exits `0`; the existing React Compiler warning in `src/components/data-table.tsx` may still appear as a warning.

- [ ] **Step 2: Run production build**

Run: `npm run build`

Expected: Next.js build exits `0`. If Turbopack fails in sandbox with `Operation not permitted` while binding a port or creating a process, rerun with escalated permissions.

- [ ] **Step 3: Manual QA handoff**

Ask the user to manually verify:

- the old Company Mode pills no longer appear under `RockPit`
- the icon-only Company button appears before `Planner`
- locked state opens unlock dialog
- unlocked state opens a small Company Mode menu
- mobile menu contains Company Mode actions after PWA install

## Self-Review Notes

- Spec coverage: desktop icon-only button, locked/unlocked behavior, mobile behavior, removed headline pills, route targets, and verification are all covered.
- The plan keeps behavior local to Company Mode entrypoint and does not touch company CRUD or other productivity buttons.
- No placeholder steps remain.
