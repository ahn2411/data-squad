import { AlertTriangle, Check } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

const highlights = [
  "24-week structured roadmap",
  "Assignments, submissions, and peer review",
  "Progress calculated from real activity",
];

interface AuthShellProps {
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** When true, shows a compact inline notice (not a loud banner). */
  notConfigured?: boolean;
  className?: string;
}

export function AuthShell({
  title,
  description,
  children,
  footer,
  notConfigured,
  className,
}: AuthShellProps) {
  return (
    <div className="flex min-h-svh bg-background">
      {/* Brand panel — desktop only */}
      <aside
        className="relative hidden w-[42%] max-w-md flex-col justify-between overflow-hidden border-r border-border p-10 lg:flex"
        style={{
          backgroundColor: "color-mix(in oklch, var(--primary) 2.5%, var(--background))",
          backgroundImage:
            "radial-gradient(circle at center, color-mix(in oklch, var(--primary) 9%, transparent) 1px, transparent 1px)",
          backgroundSize: "18px 18px",
        }}
      >
        <Logo showWordmark />
        <div className="relative">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary/70">
            Data Science Squad
          </p>
          <h2 className="mt-3 text-2xl font-semibold leading-tight tracking-tight text-foreground">
            From confused to competent
          </h2>
          <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-muted-foreground">
            A private workspace for the squad's 24-week learning journey —
            roadmap, assignments, submissions, and progress in one place.
          </p>
          <ul className="mt-6 space-y-2.5">
            {highlights.map((h) => (
              <li key={h} className="flex items-center gap-2.5 text-[13px] text-foreground/80">
                <span className="flex size-4 items-center justify-center rounded-full bg-primary/12 text-primary">
                  <Check className="size-2.5" strokeWidth={3} />
                </span>
                {h}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-[12px] text-muted-foreground/70">
          Private platform · 6 members
        </p>
      </aside>

      {/* Form panel */}
      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <div className={cn("w-full max-w-sm", className)}>
          <div className="mb-8 flex flex-col items-center text-center lg:items-start lg:text-left">
            <div className="mb-5 lg:hidden">
              <Logo showWordmark />
            </div>
            <h1 className="text-lg font-semibold tracking-tight text-foreground">
              {title}
            </h1>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              {description}
            </p>
          </div>

          {notConfigured ? (
            <div className="mb-4 flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2">
              <AlertTriangle className="size-3.5 shrink-0 text-muted-foreground" />
              <p className="text-[12px] text-muted-foreground">
                Supabase not configured — sign-in is disabled.
              </p>
            </div>
          ) : null}

          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            {children}
          </div>

          {footer ? (
            <div className="mt-6 text-center text-[13px] text-muted-foreground lg:text-left">
              {footer}
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
