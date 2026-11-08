import { cn } from "@/lib/utils";
import type { TeamRole, MembershipStatus } from "@/types/database";

type Tone = "navy" | "teal" | "muted" | "warning" | "danger" | "success";

const toneStyles: Record<Tone, string> = {
  navy: "bg-primary/10 text-primary",
  teal: "bg-teal/10 text-teal",
  muted: "bg-muted text-muted-foreground",
  warning: "bg-warning/10 text-warning",
  danger: "bg-destructive/10 text-destructive",
  success: "bg-success/10 text-success",
};

const dotStyles: Record<Tone, string> = {
  navy: "bg-primary",
  teal: "bg-teal",
  muted: "bg-muted-foreground",
  warning: "bg-warning",
  danger: "bg-destructive",
  success: "bg-success",
};

export function StatusPill({
  tone,
  children,
  className,
}: {
  tone: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[12px] font-medium leading-5",
        toneStyles[tone],
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", dotStyles[tone])} aria-hidden="true" />
      {children}
    </span>
  );
}

const roleConfig: Record<TeamRole, { tone: Tone; label: string }> = {
  admin: { tone: "navy", label: "Admin" },
  leader: { tone: "teal", label: "Leader" },
  member: { tone: "muted", label: "Member" },
};

export function RoleBadge({ role }: { role: TeamRole }) {
  const c = roleConfig[role];
  return <StatusPill tone={c.tone}>{c.label}</StatusPill>;
}

const statusConfig: Record<
  MembershipStatus,
  { tone: Tone; label: string }
> = {
  active: { tone: "success", label: "Active" },
  pending_invite: { tone: "warning", label: "Pending invite" },
  pending_approval: { tone: "warning", label: "Pending approval" },
  suspended: { tone: "danger", label: "Suspended" },
  removed: { tone: "muted", label: "Removed" },
};

export function MembershipBadge({ status }: { status: MembershipStatus }) {
  const c = statusConfig[status];
  return <StatusPill tone={c.tone}>{c.label}</StatusPill>;
}
