# Top Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a consistent global top navigation for authenticated RockPit pages (desktop + mobile) without changing existing business behavior.

**Architecture:** Add a reusable `AppTopNav` component and inject it from a shared `AppShell` wrapper in `RootLayout`, with a centralized route matcher for active state. Keep page-level functional logic intact, remove duplicated top-level nav controls from `Home`, and preserve contextual page actions.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS, Vitest + Testing Library (new), ESLint.

---

## File Structure Map

- Create: `src/lib/navigation.ts`
  - Single source of truth for nav items, public route detection, and active-route matching.
- Create: `src/components/app-top-nav.tsx`
  - Desktop top nav + mobile menu trigger/list with active state and accessibility attributes.
- Create: `src/components/app-shell.tsx`
  - Wrapper used by root layout; decides whether top nav is shown (hide on `/login` and `/register`).
- Modify: `src/app/layout.tsx`
  - Mount `AppShell` around page children.
- Modify: `src/app/page.tsx`
  - Remove duplicated global nav controls; keep contextual actions only.
- Create: `src/lib/navigation.test.ts`
  - Unit tests for active-route mapping and public-route matching.
- Create: `src/components/app-top-nav.test.tsx`
  - Component tests for desktop/mobile active state and accessibility.
- Create: `vitest.config.ts`
  - Vitest config (`jsdom` environment + alias support).
- Create: `vitest.setup.ts`
  - Testing setup (`@testing-library/jest-dom`).
- Modify: `tsconfig.json`
  - Include test globals types if needed.
- Modify: `package.json`
  - Add test scripts and dev dependencies.

## Task 1: Set Up Test Harness (Vitest + RTL)

**Files:**
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Modify: `package.json`
- Modify: `tsconfig.json`

- [ ] **Step 1: Write the failing test file first**

```ts
// src/lib/navigation.test.ts
import { describe, expect, it } from "vitest";
import { getActiveNavKey } from "@/lib/navigation";

describe("getActiveNavKey", () => {
  it("maps /boards/123 to boards", () => {
    expect(getActiveNavKey("/boards/123")).toBe("boards");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/lib/navigation.test.ts`  
Expected: FAIL with missing test runner/config and/or missing module `@/lib/navigation`.

- [ ] **Step 3: Add minimal test tooling**

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

```ts
// vitest.setup.ts
import "@testing-library/jest-dom/vitest";
```

```json
// package.json (scripts + devDependencies excerpt)
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.2.0",
    "@testing-library/user-event": "^14.6.1",
    "jsdom": "^26.1.0",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 4: Run test again to verify controlled failure**

Run: `npm run test -- src/lib/navigation.test.ts`  
Expected: FAIL with `Cannot find module '@/lib/navigation'` (good, next task owns it).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts vitest.setup.ts src/lib/navigation.test.ts
git commit -m "test: add vitest setup for navigation work"
```

## Task 2: Implement Navigation Route Mapping Utility (TDD)

**Files:**
- Create: `src/lib/navigation.ts`
- Modify: `src/lib/navigation.test.ts`

- [ ] **Step 1: Expand failing unit tests**

```ts
// src/lib/navigation.test.ts
import { describe, expect, it } from "vitest";
import { getActiveNavKey, isPublicRoute, navItems } from "@/lib/navigation";

describe("navigation mapping", () => {
  it("has expected nav order", () => {
    expect(navItems.map((item) => item.key)).toEqual([
      "home",
      "boards",
      "tasks",
      "planner",
      "helicopter",
    ]);
  });

  it("maps root to home", () => {
    expect(getActiveNavKey("/")).toBe("home");
  });

  it("maps nested board detail to boards", () => {
    expect(getActiveNavKey("/boards/abc")).toBe("boards");
  });

  it("maps unknown path to null", () => {
    expect(getActiveNavKey("/settings")).toBeNull();
  });

  it("marks login/register as public", () => {
    expect(isPublicRoute("/login")).toBe(true);
    expect(isPublicRoute("/register")).toBe(true);
    expect(isPublicRoute("/boards")).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm run test -- src/lib/navigation.test.ts`  
Expected: FAIL because `navigation.ts` does not exist yet.

- [ ] **Step 3: Add minimal implementation**

```ts
// src/lib/navigation.ts
export type NavKey = "home" | "boards" | "tasks" | "planner" | "helicopter";

export const navItems: { key: NavKey; label: string; href: string }[] = [
  { key: "home", label: "Home", href: "/" },
  { key: "boards", label: "Boards", href: "/boards" },
  { key: "tasks", label: "Tasks", href: "/tasks" },
  { key: "planner", label: "Planner", href: "/planner" },
  { key: "helicopter", label: "Helicopter", href: "/helicopter" },
];

export function isPublicRoute(pathname: string) {
  return pathname === "/login" || pathname === "/register";
}

export function getActiveNavKey(pathname: string): NavKey | null {
  if (pathname === "/") return "home";
  if (pathname === "/boards" || pathname.startsWith("/boards/")) return "boards";
  if (pathname === "/tasks" || pathname.startsWith("/tasks/")) return "tasks";
  if (pathname === "/planner" || pathname.startsWith("/planner/")) return "planner";
  if (pathname === "/helicopter" || pathname.startsWith("/helicopter/")) return "helicopter";
  return null;
}
```

- [ ] **Step 4: Run tests and lint**

Run:  
- `npm run test -- src/lib/navigation.test.ts`  
- `npm run lint -- src/lib/navigation.ts src/lib/navigation.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/navigation.ts src/lib/navigation.test.ts
git commit -m "feat: add shared navigation route mapping utility"
```

## Task 3: Build `AppTopNav` Component (TDD)

**Files:**
- Create: `src/components/app-top-nav.tsx`
- Create: `src/components/app-top-nav.test.tsx`

- [ ] **Step 1: Write failing component tests**

```tsx
// src/components/app-top-nav.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppTopNav } from "@/components/app-top-nav";

describe("AppTopNav", () => {
  it("renders all primary destinations", () => {
    render(<AppTopNav pathname="/tasks" />);
    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Boards" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tasks" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Planner" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Helicopter" })).toBeInTheDocument();
  });

  it("marks active item with aria-current", () => {
    render(<AppTopNav pathname="/boards/123" />);
    expect(screen.getByRole("link", { name: "Boards" })).toHaveAttribute("aria-current", "page");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/components/app-top-nav.test.tsx`  
Expected: FAIL because component file is missing.

- [ ] **Step 3: Implement minimal component**

```tsx
// src/components/app-top-nav.tsx
"use client";

import Link from "next/link";
import { getActiveNavKey, navItems } from "@/lib/navigation";

export function AppTopNav({ pathname }: { pathname: string }) {
  const active = getActiveNavKey(pathname);

  return (
    <header className="sticky top-0 z-40 border-b bg-white/90 backdrop-blur">
      <nav aria-label="Primary" className="mx-auto flex w-full max-w-7xl items-center gap-2 px-4 py-3 md:px-8">
        {navItems.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            aria-current={active === item.key ? "page" : undefined}
            className={
              active === item.key
                ? "rounded-full bg-primary px-3 py-2 text-sm text-primary-foreground"
                : "rounded-full px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
            }
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `npm run test -- src/components/app-top-nav.test.tsx`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/app-top-nav.tsx src/components/app-top-nav.test.tsx
git commit -m "feat: add reusable top navigation component"
```

## Task 4: Add `AppShell` and Mount It in Root Layout

**Files:**
- Create: `src/components/app-shell.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Write failing behavior test for shell visibility**

```tsx
// src/components/app-shell.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppShell } from "@/components/app-shell";

describe("AppShell", () => {
  it("hides top nav on login", () => {
    render(<AppShell pathname="/login"><div>Page</div></AppShell>);
    expect(screen.queryByLabelText("Primary")).not.toBeInTheDocument();
  });

  it("shows top nav on authenticated pages", () => {
    render(<AppShell pathname="/boards"><div>Page</div></AppShell>);
    expect(screen.getByLabelText("Primary")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm run test -- src/components/app-shell.test.tsx`  
Expected: FAIL because `AppShell` does not exist.

- [ ] **Step 3: Implement shell + integrate layout**

```tsx
// src/components/app-shell.tsx
"use client";

import { usePathname } from "next/navigation";
import { AppTopNav } from "@/components/app-top-nav";
import { isPublicRoute } from "@/lib/navigation";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const hideNav = isPublicRoute(pathname);

  return (
    <>
      {hideNav ? null : <AppTopNav pathname={pathname} />}
      {children}
    </>
  );
}
```

```tsx
// src/app/layout.tsx (body section)
<body className="min-h-full flex flex-col">
  <AppShell>{children}</AppShell>
  <PwaRegister />
</body>
```

- [ ] **Step 4: Run tests + typecheck**

Run:  
- `npm run test -- src/components/app-shell.test.tsx src/components/app-top-nav.test.tsx`  
- `npx tsc --noEmit`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/app-shell.tsx src/components/app-shell.test.tsx src/app/layout.tsx
git commit -m "feat: mount global app shell with conditional top nav"
```

## Task 5: Remove Home’s Duplicated Global Nav Controls

**Files:**
- Modify: `src/app/page.tsx`
- Test: `src/app/page.home-nav.test.tsx`

- [ ] **Step 1: Write failing regression test for Home structure**

```tsx
// src/app/page.home-nav.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "@/app/page";

describe("Home navigation cleanup", () => {
  it("does not render duplicated global destination controls", () => {
    render(<Home />);
    expect(screen.queryByText("Planner")).not.toBeInTheDocument();
    expect(screen.queryByText("Helicopter View")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm run test -- src/app/page.home-nav.test.tsx`  
Expected: FAIL because old home header still renders duplicated controls.

- [ ] **Step 3: Implement cleanup**

```tsx
// src/app/page.tsx (intent)
// Remove global nav-specific desktop buttons and mobile menu dropdown that duplicate routing destinations.
// Keep local page actions: PWA install, sign out, and workspace-specific controls.
```

- [ ] **Step 4: Run focused checks**

Run:  
- `npm run test -- src/app/page.home-nav.test.tsx`  
- `npm run lint -- src/app/page.tsx`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/app/page.home-nav.test.tsx
git commit -m "refactor: remove duplicated home-level global navigation controls"
```

## Task 6: End-to-End Verification and Regression Sweep

**Files:**
- Modify (if needed from findings): `src/components/app-top-nav.tsx`, `src/app/page.tsx`, `src/lib/navigation.ts`

- [ ] **Step 1: Run full automated checks**

Run:  
- `npm run test`  
- `npm run lint`  
- `npx tsc --noEmit`  
Expected: PASS all.

- [ ] **Step 2: Run manual QA matrix**

```txt
Desktop:
- / -> Home active
- /boards -> Boards active
- /boards/<id> -> Boards active
- /tasks -> Tasks active
- /planner -> Planner active
- /helicopter -> Helicopter active

Mobile:
- Open menu, verify same nav order and active state.
- Navigate across all destinations from menu.

Regression smoke:
- Add/edit/delete task
- Pin/unpin board + burnout swap modal
- Planner timer start/stop/save
- Board detail report PDF download
```

- [ ] **Step 3: Fix defects (if any) with targeted patch + tests**

```ts
// Add/adjust tests before each defect fix.
// Keep fixes minimal and scoped to detected regressions.
```

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: deliver global top navigation across authenticated pages"
```

---

## Plan Self-Review

### 1. Spec Coverage
- Global top nav on authenticated pages: covered by Tasks 3-4.
- Fixed IA and route mapping (including `/boards/[id]`): covered by Task 2.
- Home duplication cleanup: covered by Task 5.
- Desktop/mobile behavior and accessibility baseline: covered by Tasks 3, 6.
- Regression safety: covered by Task 6 QA and automated checks.

### 2. Placeholder Scan
- No `TBD`, `TODO`, or “implement later” placeholders used as unresolved instructions.
- Commands and expected outcomes are explicit per task.

### 3. Type Consistency
- `NavKey`, `navItems`, `getActiveNavKey`, and `isPublicRoute` naming stays consistent across all tasks and test snippets.
