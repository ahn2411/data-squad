import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { Logo } from "@/components/brand/logo";

/**
 * Shown when NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
 * are missing. Designed to be useful, not just an error — it states exactly
 * what to set and where, so a new developer can recover in one step.
 */
export function NotConfiguredScreen() {
  return (
    <div className="flex min-h-svh flex-col">
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          <Logo showWordmark className="mb-10" />
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-md bg-warning/10 text-warning">
                <AlertTriangle className="size-4" />
              </span>
              <h1 className="text-[15px] font-semibold tracking-tight">
                Supabase is not configured
              </h1>
            </div>
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              The app needs a Supabase project to handle authentication,
              database, and storage. Add the following to{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[12px] text-foreground">
                .env.local
              </code>{" "}
              and restart the dev server.
            </p>
            <pre className="mt-4 overflow-x-auto rounded-lg border border-border bg-muted/60 p-3.5 font-mono text-[12px] leading-relaxed text-foreground">
{`NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key`}
            </pre>
            <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">
              Find these in your Supabase dashboard under{" "}
              <span className="text-foreground">Project Settings &rarr; API</span>
              . Then apply the schema migration and bootstrap the first admin
              (see the README).
            </p>
            <Link
              href="/login"
              className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline"
            >
              Retry connection
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
          <p className="mt-6 text-center text-[12px] text-muted-foreground">
            Data Science Squad Hub — private learning platform
          </p>
        </div>
      </main>
    </div>
  );
}
