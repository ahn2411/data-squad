import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Flag,
  Maximize,
  ClipboardList,
  BookOpen,
  ListChecks,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Download,
} from "lucide-react";
import { requireActiveMember } from "@/features/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AssignmentTypeBadge,
  DifficultyBadge,
  SubmissionStatusBadge,
  LateBadge,
} from "@/features/assignments/badges";
import { getAssignmentDetail } from "@/features/assignments/queries";
import { formatDate, formatDateTime } from "@/lib/format";
import { SubmissionForm } from "./submission-form";
import { SubmissionRevisionList } from "@/features/submissions/submission-revision-list";
import { ReviewList } from "@/features/submissions/review-list";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AssignmentDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await requireActiveMember();

  let assignment = null;
  let loadError: string | null = null;
  try {
    assignment = await getAssignmentDetail(id);
  } catch {
    loadError = "Could not load this assignment.";
  }

  if (loadError) {
    return (
      <>
        <PageHeader title="Assignment" />
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
        <Button asChild variant="outline" size="sm" className="mt-3 h-9">
          <Link href="/assignments">
            <ArrowLeft className="size-4" />
            Back to assignments
          </Link>
        </Button>
      </>
    );
  }

  if (!assignment) {
    notFound();
  }

  const supabase = await createSupabaseServerClient();
  const assignmentFiles = await Promise.all(
    assignment.assignment_files.map(async (file) => {
      const { data } = await supabase.storage
        .from("squad-attachments")
        .createSignedUrl(file.storage_path, 300, { download: true });
      return data?.signedUrl ? { ...file, signedUrl: data.signedUrl } : null;
    }),
  );

  const sub = assignment.my_submission;
  const isOverdue =
    assignment.deadline !== null &&
    new Date(assignment.deadline) < new Date() &&
    sub?.status !== "approved";

  return (
    <>
      <div className="flex flex-col gap-3 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          <Link
            href="/assignments"
            className="inline-flex items-center gap-1 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Assignments
          </Link>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            {assignment.title}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <AssignmentTypeBadge type={assignment.assignment_type} />
            <DifficultyBadge difficulty={assignment.difficulty} />
            {sub ? <SubmissionStatusBadge status={sub.status} /> : null}
            {sub?.is_late ? <LateBadge /> : null}
            {isOverdue && !sub ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-destructive/10 px-2 py-0.5 text-[12px] font-medium text-destructive">
                <AlertCircle className="size-3" />
                Overdue
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <SubmissionForm
            assignmentId={assignment.id}
            requiredSubmissionType={assignment.required_submission_type}
            teamId={session.membership.team_id}
            userId={session.userId}
            existingSubmission={
              sub
                ? {
                    id: sub.id,
                    status: sub.status,
                    submission_text: sub.submission_text,
                    submission_url: sub.submission_url,
                    files: sub.submission_files.map((file) => ({
                      file_name: file.file_name,
                    })),
                  }
                : null
            }
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Main column */}
        <div className="space-y-4">
          {assignment.description ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-[14px]">Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-[13px] leading-relaxed text-foreground whitespace-pre-wrap">
                  {assignment.description}
                </p>
              </CardContent>
            </Card>
          ) : null}

          {assignment.instructions ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-1.5 text-[14px]">
                  <ClipboardList className="size-4 text-muted-foreground" />
                  Instructions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-foreground">
                  {assignment.instructions}
                </pre>
              </CardContent>
            </Card>
          ) : null}

          {assignment.deliverables.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-1.5 text-[14px]">
                  <ListChecks className="size-4 text-muted-foreground" />
                  Deliverables
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5 text-[13px]">
                  {assignment.deliverables.map((d, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" />
                      <span className="text-foreground">{d}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          {assignment.evaluation_criteria.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-1.5 text-[14px]">
                  <Flag className="size-4 text-muted-foreground" />
                  Evaluation criteria
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5 text-[13px]">
                  {assignment.evaluation_criteria.map((c, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-1 size-1.5 shrink-0 rounded-full bg-muted-foreground" />
                      <span className="text-foreground">{c}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          {/* My submission content + revisions + reviews */}
          {sub ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-[14px]">Your submission</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <SubmissionStatusBadge status={sub.status} />
                    {sub.is_late ? <LateBadge /> : null}
                    {sub.submitted_at ? (
                      <span className="nums text-[12px] text-muted-foreground">
                        submitted {formatDateTime(sub.submitted_at)}
                      </span>
                    ) : null}
                  </div>
                  <Separator />
                  {sub.submission_url ? (
                    <div>
                      <p className="mb-1 text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
                        URL
                      </p>
                      <a
                        href={sub.submission_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[13px] text-primary underline-offset-2 hover:underline"
                      >
                        {sub.submission_url}
                        <ExternalLink className="size-3.5" />
                      </a>
                    </div>
                  ) : null}
                  {sub.submission_text ? (
                    <div>
                      <p className="mb-1 text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
                        Text
                      </p>
                      <pre className="whitespace-pre-wrap break-words font-sans text-[13px] leading-relaxed text-foreground">
                        {sub.submission_text}
                      </pre>
                    </div>
                  ) : null}
                  {!sub.submission_url && !sub.submission_text ? (
                    <p className="text-[13px] text-muted-foreground">
                      No content captured yet.
                    </p>
                  ) : null}
                </CardContent>
              </Card>

              {sub.submission_revisions.length > 0 ? (
                <SubmissionRevisionList revisions={sub.submission_revisions} />
              ) : null}

              {sub.reviews.length > 0 ? (
                <ReviewList reviews={sub.reviews} />
              ) : null}
            </>
          ) : null}
        </div>

        {/* Side column */}
        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-[14px]">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-[13px]">
              <DetailRow
                icon={<Calendar className="size-3.5" />}
                label="Deadline"
                value={
                  assignment.deadline ? (
                    <span className={isOverdue ? "text-destructive font-medium" : ""}>
                      {formatDateTime(assignment.deadline)}
                    </span>
                  ) : (
                    "No deadline"
                  )
                }
              />
              <DetailRow
                icon={<Maximize className="size-3.5" />}
                label="Max score"
                value={assignment.max_score !== null ? String(assignment.max_score) : "—"}
              />
              <DetailRow
                icon={<ClipboardList className="size-3.5" />}
                label="Submission type"
                value={
                  assignment.required_submission_type
                    ? assignment.required_submission_type.replace(/_/g, " ")
                    : "Any"
                }
              />
              {assignment.phases ? (
                <DetailRow
                  icon={<BookOpen className="size-3.5" />}
                  label="Phase"
                  value={assignment.phases.title}
                />
              ) : null}
              {assignment.weeks ? (
                <DetailRow
                  icon={<BookOpen className="size-3.5" />}
                  label="Week"
                  value={`${assignment.weeks.title}`}
                />
              ) : null}
            </CardContent>
          </Card>

          {assignment.supporting_resources.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-1.5 text-[14px]">
                  <BookOpen className="size-4 text-muted-foreground" />
                  Supporting resources
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {assignment.supporting_resources.map((url, i) => (
                    <li key={i}>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-start gap-1.5 text-[13px] text-primary underline-offset-2 hover:underline break-all"
                      >
                        <ExternalLink className="mt-0.5 size-3.5 shrink-0" />
                        {url}
                      </a>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          {assignmentFiles.some(Boolean) ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-1.5 text-[14px]">
                  <ExternalLink className="size-4 text-muted-foreground" />
                  Assignment files
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {assignmentFiles.map((file) => file ? (
                    <li key={file.id}>
                      <a
                        href={file.signedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-start gap-1.5 break-all text-[13px] text-primary underline-offset-2 hover:underline"
                      >
                        <Download className="mt-0.5 size-3.5 shrink-0" />
                        {file.file_name}
                      </a>
                    </li>
                  ) : null)}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </aside>
      </div>
    </>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <span className="text-muted-foreground">{icon}</span>
        {label}
      </span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}
