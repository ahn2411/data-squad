"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  const mounted = React.useSyncExternalStore(
    subscribeToNothing,
    getClientMountedSnapshot,
    getServerMountedSnapshot,
  );

  const isDark = mounted ? resolvedTheme === "dark" : false;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-8 text-muted-foreground hover:text-foreground"
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {mounted ? (
        isDark ? <Sun className="size-4" /> : <Moon className="size-4" />
      ) : (
        <Sun className="size-4 opacity-0" />
      )}
    </Button>
  );
}

function subscribeToNothing() {
  return () => {};
}

function getClientMountedSnapshot() {
  return true;
}

function getServerMountedSnapshot() {
  return false;
}
