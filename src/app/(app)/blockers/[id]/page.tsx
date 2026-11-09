import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ExternalLink,
  AlertCircle,
  TriangleAlert,
  BookOpen,
  ClipboardList,
  MessageSquare,
  Calendar,
} from "lucide-react";
import { requireActiveMember } from "@/features/auth/session";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  BlockerStatusBadge,
  BlockerPriorityBadge,
} from "@/features/collaboration/badges";
import {
  getBlockerDetail,
  getActiveMembersForAssignment,
  type BlockerDetail,
} from "@/features/blockers/queries";
import { formatDate, formatDateTime, relativeTime, initials } from "@/lib/format";
import { BlockerStatusForm } from "./blocker-status-form";
import { BlockerComments } from "./blocker-comments";
import { BlockerOwnerControls } from "./blocker-owner-controls";
import { BlockerAttachments } from "./blocker-attachments";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function BlockerDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await requireActiveMember();

  let blocker: BlockerDetail | null = null;
  let loadError: string | null = null;
  try {
    blocker = await getBlockerDetail(id);
  } catch {
    loadError = "Could not load this blocker.";
  }

  if (loadError) {
    return (
      <>
        <PageHeader title="Blocker" />
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
        <Button asChild variant="outline" size="sm" className="mt-3 h-9">
          <Link href="/blockers">
            <ArrowLeft className="size-4" />
            Back to blockers
          </Link>
        </Button>
      </>
    );
  }

  if (!blocker) {
    notFound();
  }

  const isOwn = blocker.user_id === session.userId;
  const canManage =
    !isOwn &&
    (session.membership.role === "admin" ||
      session.membership.role === "leader");

  const reporterName = blocker.reporter?.full_name ?? "Member";

  let members: Array<{ id: string; name: string }> = [];
  if (canManage) {
    try {
      members = await getActiveMembersForAssignment();
    } catch {
      members = [];
    }
  }

  return (
    <>
      <div className="flex flex-col gap-3 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          <Link
            href="/blockers"
            className="inline-flex items-center gap-1 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Blockers
          </Link>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            {blocker.title}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <BlockerStatusBadge status={blocker.status} />
            <BlockerPriorityBadge priority={blocker.priority} />
            <span className="nums text-[12px] text-muted-foreground">
              reported {relativeTime(blocker.created_at)}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button asChild variant="outline" size="sm" className="h-9">
            <Link href="/blockers">
              <ArrowLeft className="size-4" />
              Back
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {/* Reporter context (only when not own) */}
          {!isOwn ? (
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <Avatar className="size-9 border border-border">
                  <AvatarFallback className="bg-primary/10 text-[12px] font-medium text-primary">
                    {initials(reporterName)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-[13px] font-medium text-foreground">
                    {reporterName}
                  </p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Reported
                  </p>
                  <p className="nums text-[13px] font-medium">
                    {formatDateTime(blocker.created_at)}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5 text-[14px]">
                <TriangleAlert className="size-4 text-muted-foreground" />
                Description
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {blocker.description ? (
                <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-foreground">
                  {blocker.description}
                </p>
              ) : (
                <p className="text-[13px] text-muted-foreground">
                  No description provided.
                </p>
              )}

              {blocker.error_messages ? (
                <>
                  <Separator />
                  <div>
                    <p className="mb-1.5 text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
                      Error messages
                    </p>
                    <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-md border border-border bg-muted/20 p-3 font-mono text-[12px] leading-relaxed text-foreground">
                      {blocker.error_messages}
                    </pre>
                  </div>
                </>
              ) : null}

              {blocker.code_url ? (
                <>
                  <Separator />
                  <div>
                    <p className="mb-1.5 text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
                      Code link
                    </p>
                    <a
                      href={blocker.code_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[13px] text-primary underline-offset-2 hover:underline break-all"
                    >
                      {blocker.code_url}
                      <ExternalLink className="size-3.5 shrink-0" />
                    </a>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>

          {/* Resolution notes (when present) */}
          {blocker.resolution_notes ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-[14px]">Resolution notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-foreground">
                  {blocker.resolution_notes}
                </p>
              </CardContent>
            </Card>
          ) : null}

          {/* Comments */}
          <BlockerComments
            blockerId={blocker.id}
            comments={blocker.comments}
            currentUserId={session.userId}
          />
          <BlockerAttachments
            blockerId={blocker.id}
            teamId={session.membership.team_id}
            userId={session.userId}
            canUpload={isOwn || canManage}
            canManage={session.membership.role === "admin" || session.membership.role === "leader"}
            canRemoveAll={isOwn}
            files={blocker.files}
          />
        </div>

        {/* Side column */}
        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-[14px]">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-[13px]">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Status</span>
                <BlockerStatusBadge status={blocker.status} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Priority</span>
                <BlockerPriorityBadge priority={blocker.priority} />
              </div>
              <Separator />
              {blocker.helper ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Helper</span>
                  <span className="font-medium text-foreground">
                    {blocker.helper.full_name ?? "Member"}
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Helper</span>
                  <span className="text-muted-foreground">—</span>
                </div>
              )}
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <Calendar className="size-3.5" />
                  Reported
                </span>
                <span className="nums font-medium">
                  {formatDate(blocker.created_at)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <MessageSquare className="size-3.5" />
                  Comments
                </span>
                <span className="nums font-medium">
                  {blocker.comments.length}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Related context */}
          {(blocker.topics || blocker.assignments) ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-[14px]">Related to</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-[13px]">
                {blocker.topics ? (
                  <Link
                    href={`/roadmap/topic/${blocker.topics.id}`}
                    className="flex items-center gap-2 text-foreground transition-colors hover:text-primary"
                  >
                    <BookOpen className="size-3.5 text-muted-foreground" />
                    <span className="truncate">{blocker.topics.title}</span>
                  </Link>
                ) : null}
                {blocker.assignments ? (
                  <Link
                    href={`/assignments/${blocker.assignments.id}`}
                    className="flex items-center gap-2 text-foreground transition-colors hover:text-primary"
                  >
                    <ClipboardList className="size-3.5 text-muted-foreground" />
                    <span className="truncate">
                      {blocker.assignments.title}
                    </span>
                  </Link>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {/* Leader/admin status manager */}
          {canManage ? (
            <BlockerStatusForm
              blockerId={blocker.id}
              currentStatus={blocker.status}
              currentHelperId={blocker.assigned_helper}
              currentResolutionNotes={blocker.resolution_notes}
              members={members}
            />
          ) : null}

          {isOwn ? (
            <BlockerOwnerControls blockerId={blocker.id} status={blocker.status} />
          ) : null}

          {/* Member self-hint when own + unresolved */}
          {isOwn && blocker.status !== "resolved" && blocker.status !== "closed" ? (
            <Card className="border-warning/30 bg-warning/5">
              <CardContent className="p-4 text-[12px] text-foreground">
                <p className="font-medium">Waiting for help</p>
                <p className="mt-1 text-muted-foreground">
                  A leader will see this in the team blockers queue. You can
                  keep adding details in the comments below.
                </p>
              </CardContent>
            </Card>
          ) : null}
        </aside>
      </div>
    </>
  );
}
