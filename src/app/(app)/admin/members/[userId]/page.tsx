import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Children, type ReactNode } from "react";
import { ArrowLeft, BookOpenCheck, ClipboardCheck, FileText, TriangleAlert, Github, ExternalLink } from "lucide-react";
import { requireActiveMember } from "@/features/auth/session";
import { getAdminMemberOverview } from "@/features/members/queries";
import { PageHeader } from "@/components/page-header";
import { RoleBadge, MembershipBadge } from "@/components/status-pill";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatDate, initials } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";

interface PageProps {
  params: Promise<{ userId: string }>;
}

export default async function AdminMemberDetailPage({ params }: PageProps) {
  const session = await requireActiveMember();
  if (session.membership.role !== "admin" && session.membership.role !== "leader") redirect("/dashboard");
  const { userId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) notFound();

  let overview: Awaited<ReturnType<typeof getAdminMemberOverview>>;
  try {
    overview = await getAdminMemberOverview(userId);
  } catch {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-destructive" role="alert">
          Could not load this member&apos;s profile and learning history. Refresh and try again.
        </CardContent>
      </Card>
    );
  }
  if (!overview) notFound();

  const profile = overview.member.profiles;
  const name = profile?.full_name ?? profile?.username ?? "Squad member";
  const progressPercent = overview.totalTopics ? Math.round(overview.completedTopics / overview.totalTopics * 100) : 0;
  let avatarUrl: string | null = null;
  if (profile?.avatar_url) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.storage.from("squad-avatars").createSignedUrl(profile.avatar_url, 60 * 60);
    avatarUrl = data?.signedUrl ?? null;
  }

  return (
    <>
      <PageHeader
        title={name}
        description="Member profile and learning activity for this squad."
        action={<Button asChild size="sm" variant="outline"><Link href="/admin/members"><ArrowLeft className="size-4" />Back to members</Link></Button>}
      />

      <Card className="mb-5">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:p-6">
          <Avatar className="size-14 border border-border">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
            <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">{initials(name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2"><RoleBadge role={overview.member.role} /><MembershipBadge status={overview.member.membership_status} /></div>
            {profile?.bio ? <p className="max-w-3xl whitespace-pre-wrap text-sm text-foreground">{profile.bio}</p> : null}
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span>Joined {formatDate(overview.member.joined_at ?? overview.member.created_at)}</span>
              {profile?.github_profile_url ? <a className="inline-flex items-center gap-1 text-primary hover:underline" href={profile.github_profile_url} target="_blank" rel="noreferrer"><Github className="size-3.5" />GitHub <ExternalLink className="size-3" /></a> : null}
              {profile?.capstone_repository_url ? <a className="inline-flex items-center gap-1 text-primary hover:underline" href={profile.capstone_repository_url} target="_blank" rel="noreferrer">Capstone repository <ExternalLink className="size-3" /></a> : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard icon={<BookOpenCheck className="size-4" />} label="Roadmap topics">
          <p className="nums text-lg font-semibold">{overview.completedTopics} / {overview.totalTopics}</p>
          <Progress value={progressPercent} className="mt-2 h-1.5" />
          <p className="mt-1 text-[11px] text-muted-foreground">{progressPercent}% complete</p>
        </SummaryCard>
        <SummaryCard icon={<ClipboardCheck className="size-4" />} label="Approved assignments">
          <p className="nums text-lg font-semibold">{overview.approvedAssignments}</p>
          <p className="text-[11px] text-muted-foreground">of {overview.totalSubmissions} submissions</p>
        </SummaryCard>
        <SummaryCard icon={<FileText className="size-4" />} label="Weekly reports">
          <p className="nums text-lg font-semibold">{overview.totalReports}</p>
          <p className="text-[11px] text-muted-foreground">submitted reports</p>
        </SummaryCard>
        <SummaryCard icon={<TriangleAlert className="size-4" />} label="Open blockers">
          <p className="nums text-lg font-semibold">{overview.openBlockers}</p>
          <p className="text-[11px] text-muted-foreground">awaiting resolution</p>
        </SummaryCard>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <HistoryCard title="Recent assignment submissions" empty="No submissions recorded.">
          {overview.submissions.map((submission) => (
            <Link key={submission.id} href={`/submissions/${submission.id}`} className="flex items-center justify-between gap-3 rounded-md px-2 py-2 hover:bg-accent">
              <span className="truncate text-sm font-medium">{submission.assignment?.title ?? "Assignment"}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{submission.status.replaceAll("_", " ")} · {formatDate(submission.submitted_at)}</span>
            </Link>
          ))}
        </HistoryCard>

        <HistoryCard title="Recent weekly reports" empty="No weekly reports submitted.">
          {overview.reports.map((report) => (
            <Link key={report.id} href={`/weekly-reports/${report.week_id}?user=${userId}`} className="flex items-center justify-between gap-3 rounded-md px-2 py-2 hover:bg-accent">
              <span className="truncate text-sm font-medium">{report.week ? `Week ${report.week.week_number} · ${report.week.title}` : "Weekly report"}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{report.hours_spent}h · {formatDate(report.submitted_at)}</span>
            </Link>
          ))}
        </HistoryCard>

        <HistoryCard title="Recent blockers" empty="No blockers reported.">
          {overview.blockers.map((blocker) => (
            <Link key={blocker.id} href={`/blockers/${blocker.id}`} className="flex items-center justify-between gap-3 rounded-md px-2 py-2 hover:bg-accent">
              <span className="truncate text-sm font-medium">{blocker.title}</span>
              <Badge variant="outline" className="shrink-0 text-[11px]">{blocker.status.replaceAll("_", " ")}</Badge>
            </Link>
          ))}
        </HistoryCard>

        <Card>
          <CardHeader><CardTitle className="text-sm">Current learning phase</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {overview.currentPhase ? `Phase ${overview.currentPhase.phaseNumber} · ${overview.currentPhase.title}` : "No published current week is configured for this squad."}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function SummaryCard({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return <Card><CardContent className="p-4"><div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>{children}</CardContent></Card>;
}

function HistoryCard({ title, empty, children }: { title: string; empty: string; children: ReactNode }) {
  const hasRows = Children.count(children) > 0;
  return <Card><CardHeader><CardTitle className="text-sm">{title}</CardTitle></CardHeader><CardContent className="space-y-1">{hasRows ? children : <p className="text-sm text-muted-foreground">{empty}</p>}</CardContent></Card>;
}
