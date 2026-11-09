import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ExternalLink,
  AlertCircle,
  ClipboardList,
  FileText,
} from "lucide-react";
import { requireActiveMember } from "@/features/auth/session";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  AssignmentTypeBadge,
  DifficultyBadge,
  SubmissionStatusBadge,
  LateBadge,
} from "@/features/assignments/badges";
import { getSubmissionDetail } from "@/features/submissions/queries";
import { ReviewForm } from "./review-form";
import { ReviewList } from "@/features/submissions/review-list";
import { SubmissionRevisionList } from "@/features/submissions/submission-revision-list";
import { formatDate, formatDateTime, initials } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SubmissionDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await requireActiveMember();

  let submission = null;
  let loadError: string | null = null;
  try {
    submission = await getSubmissionDetail(id);
  } catch {
    loadError = "Could not load this submission.";
  }

  if (loadError) {
    return (
      <>
        <PageHeader title="Submission" />
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
        <Button asChild variant="outline" size="sm" className="mt-3 h-9">
          <Link href="/submissions">
            <ArrowLeft className="size-4" />
            Back to submissions
          </Link>
        </Button>
      </>
    );
  }

  if (!submission) {
    notFound();
  }

  const assignment = submission.assignments;
  const attachmentPaths = submission.submission_files.map((file) => file.storage_path);
  const supabase = await createSupabaseServerClient();
  const { data: signedAttachments } = attachmentPaths.length
    ? await supabase.storage
        .from("squad-attachments")
        .createSignedUrls(attachmentPaths, 30 * 60, { download: true })
    : { data: [] };
  const attachmentUrls = new Map(
    (signedAttachments ?? []).flatMap((file) =>
      file.path && file.signedUrl ? [[file.path, file.signedUrl] as const] : [],
    ),
  );
  const isOwn = submission.user_id === session.userId;
  const canReview =
    !isOwn &&
    (submission.status === "submitted" || submission.status === "under_review") &&
    (session.membership.role === "admin" || session.membership.role === "leader");

  const submitterName =
    submission.profiles?.full_name ?? "Member";

  return (
    <>
      <div className="flex flex-col gap-3 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          <Link
            href={isOwn ? "/submissions" : "/admin/assignments"}
            className="inline-flex items-center gap-1 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            {isOwn ? "My submissions" : "Review queue"}
          </Link>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            {assignment.title}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <AssignmentTypeBadge type={assignment.assignment_type} />
            <DifficultyBadge difficulty={assignment.difficulty} />
            <SubmissionStatusBadge status={submission.status} />
            {submission.is_late ? <LateBadge /> : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button asChild variant="outline" size="sm" className="h-9">
            <Link href={`/assignments/${assignment.id}`}>
              <ClipboardList className="size-4" />
              View assignment
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {/* Submitter context (leader/admin view) */}
          {!isOwn ? (
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <Avatar className="size-9 border border-border">
                  <AvatarFallback className="bg-primary/10 text-[12px] font-medium text-primary">
                    {initials(submitterName)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-[13px] font-medium text-foreground">{submitterName}</p>
                  <p className="text-[12px] text-muted-foreground">
                  </p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Submitted</p>
                  <p className="nums text-[13px] font-medium">
                    {formatDateTime(submission.submitted_at)}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* Submission content */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5 text-[14px]">
                <FileText className="size-4 text-muted-foreground" />
                Submission
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <SubmissionStatusBadge status={submission.status} />
                {submission.is_late ? <LateBadge /> : null}
                <span className="nums text-[12px] text-muted-foreground">
                  submitted {formatDateTime(submission.submitted_at)}
                </span>
              </div>
              <Separator />
              {submission.submission_url ? (
                <div>
                  <p className="mb-1 text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
                    URL
                  </p>
                  <a
                    href={submission.submission_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[13px] text-primary underline-offset-2 hover:underline break-all"
                  >
                    {submission.submission_url}
                    <ExternalLink className="size-3.5 shrink-0" />
                  </a>
                </div>
              ) : null}
              {submission.submission_text ? (
                <div>
                  <p className="mb-1 text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
                    Text
                  </p>
                  <pre className="whitespace-pre-wrap break-words font-sans text-[13px] leading-relaxed text-foreground">
                    {submission.submission_text}
                  </pre>
                </div>
              ) : null}
              {!submission.submission_url && !submission.submission_text ? (
                <p className="text-[13px] text-muted-foreground">No content captured.</p>
              ) : null}

              {submission.submission_files.length > 0 ? (
                <>
                  <Separator />
                  <div>
                    <p className="mb-2 text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
                      Files
                    </p>
                    <ul className="space-y-1.5">
                      {submission.submission_files.map((f) => (
                        <li
                          key={f.id}
                          className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-1.5"
                        >
                          {attachmentUrls.has(f.storage_path) ? (
                            <a
                              href={attachmentUrls.get(f.storage_path)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="truncate text-[13px] text-primary underline-offset-4 hover:underline"
                            >
                              {f.file_name}
                            </a>
                          ) : (
                            <span className="truncate text-[13px] text-foreground">{f.file_name}</span>
                          )}
                          {f.file_size !== null ? (
                            <span className="nums text-[11px] text-muted-foreground">
                              {Math.round(f.file_size / 1024)} KB
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>

          {submission.submission_revisions.length > 0 ? (
            <SubmissionRevisionList revisions={submission.submission_revisions} />
          ) : null}

          {submission.reviews.length > 0 ? (
            <ReviewList reviews={submission.reviews} />
          ) : (
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-[13px] text-muted-foreground">
                  No reviews yet.
                </p>
              </CardContent>
            </Card>
          )}

          {canReview ? <ReviewForm submissionId={submission.id} /> : null}
        </div>

        {/* Side column */}
        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-[14px]">Assignment details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-[13px]">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Deadline</span>
                <span className="nums font-medium">
                  {formatDate(assignment.deadline)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Max score</span>
                <span className="nums font-medium">
                  {assignment.max_score !== null ? assignment.max_score : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Type</span>
                <AssignmentTypeBadge type={assignment.assignment_type} />
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </>
  );
}
