"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({ retry }: { retry: () => void }) {
  return (
    <main className="flex min-h-[60vh] items-center justify-center px-4 py-12">
      <section
        aria-labelledby="app-error-title"
        className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-center shadow-sm"
      >
        <h1 id="app-error-title" className="text-lg font-semibold tracking-tight">
          We couldn’t load this page
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          The service may be temporarily unavailable. Try again in a moment.
        </p>
        <Button className="mt-5" onClick={retry}>
          <RotateCcw className="size-4" />
          Try again
        </Button>
      </section>
    </main>
  );
}
