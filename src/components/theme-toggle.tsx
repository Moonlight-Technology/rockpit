"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function ThemeIcon({ theme }: { theme: string | undefined }) {
  if (theme === "light") {
    return <Sun className="size-5" />;
  }

  if (theme === "system") {
    return <Monitor className="size-5" />;
  }

  return <Moon className="size-5" />;
}

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const activeTheme = mounted ? theme ?? resolvedTheme ?? "dark" : "dark";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex size-11 items-center justify-center rounded-[20px] border border-border bg-card text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
        aria-label="Toggle theme"
      >
        <ThemeIcon theme={activeTheme} />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-40 rounded-2xl border border-border bg-popover p-1 text-popover-foreground shadow-xl"
      >
        <DropdownMenuItem
          className="rounded-xl px-3 py-2"
          onClick={() => setTheme("light")}
        >
          <Sun className="size-4" />
          Light
        </DropdownMenuItem>
        <DropdownMenuItem
          className="rounded-xl px-3 py-2"
          onClick={() => setTheme("dark")}
        >
          <Moon className="size-4" />
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem
          className="rounded-xl px-3 py-2"
          onClick={() => setTheme("system")}
        >
          <Monitor className="size-4" />
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
