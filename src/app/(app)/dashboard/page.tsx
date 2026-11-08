import Link from "next/link";
import {
  ArrowRight,
  UserCog,
  Users,
  Info,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { RoleBadge, MembershipBadge } from "@/components/status-pill";
import { Card, CardContent } from "@/components/ui/card";
import { getSessionContext } from "@/features/auth/session";
import { formatDate } from "@/lib/format";

export default async function DashboardPage() {
  const ctx = await getSessionContext();
  if (ctx.status !== "active") return null;

  const name = ctx.profile?.full_name ?? ctx.email;
  const team = ctx.membership.teams;
  const isAdminOrLeader =
    ctx.membership.role === "admin" || ctx.membership.role === "leader";

  const stats = [
    { label: "Role", value: <RoleBadge role={ctx.membership.role} /> },
    { label: "Status", value: <MembershipBadge status="active" /> },
    {
      label: "Team",
      value: <span className="text-[13px] font-medium">{team?.name ?? "—"}</span>,
    },
    {
      label: "Member since",
      value: (
        <span className="nums text-[13px] font-medium">
          {formatDate(ctx.membership.joined_at)}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Overview"
        description="A summary of your account and what's available right now."
      />

      {/* Stat row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="overflow-hidden">
            <CardContent className="p-4">
              <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
                {s.label}
              </p>
              <div className="mt-2">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Getting started */}
      <section className="mt-8">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
          Getting started
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Link
            href="/profile"
            className="group flex items-center justify-between rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
          >
            <span className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                <UserCog className="size-4" />
              </span>
              <span className="flex flex-col">
                <span className="text-[14px] font-medium">Complete your profile</span>
                <span className="text-[12px] text-muted-foreground">
                  Add your GitHub username and bio
                </span>
              </span>
            </span>
            <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>

          {isAdminOrLeader ? (
            <Link
              href="/admin/members"
              className="group flex items-center justify-between rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
            >
              <span className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Users className="size-4" />
                </span>
                <span className="flex flex-col">
                  <span className="text-[14px] font-medium">Manage members</span>
                  <span className="text-[12px] text-muted-foreground">
                    Approve pending requests and assign roles
                  </span>
                </span>
              </span>
              <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          ) : null}
        </div>
      </section>

      {/* Roadmap note */}
      <section className="mt-8">
        <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-4">
          <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="text-[13px] leading-relaxed text-muted-foreground">
            <p className="font-medium text-foreground">More is on the way</p>
            <p className="mt-1">
              The learning roadmap, assignments, submissions, weekly reports,
              and discussions unlock in the next development phase. This phase
              establishes authentication, membership, and the workspace shell.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
