import { StatusPill } from "@/components/status-pill";
import { Badge } from "@/components/ui/badge";
import type {
  AssignmentType,
  AssignmentDifficulty,
  SubmissionStatus,
  ReviewStatus,
  PublicationStatus,
} from "@/types/database";

const typeLabels: Record<AssignmentType, string> = {
  programming_exercise: "Programming",
  written_explanation: "Written",
  research_activity: "Research",
  data_analysis: "Data analysis",
  quiz: "Quiz",
  mini_project: "Mini project",
  group_project: "Group project",
};

export function AssignmentTypeBadge({ type }: { type: AssignmentType }) {
  return (
    <Badge variant="outline" className="text-[11px] font-medium text-muted-foreground">
      {typeLabels[type]}
    </Badge>
  );
}

const difficultyConfig: Record<
  AssignmentDifficulty,
  { tone: "muted" | "warning" | "danger"; label: string }
> = {
  beginner: { tone: "muted", label: "Beginner" },
  intermediate: { tone: "warning", label: "Intermediate" },
  advanced: { tone: "danger", label: "Advanced" },
};

export function DifficultyBadge({ difficulty }: { difficulty: AssignmentDifficulty }) {
  const c = difficultyConfig[difficulty];
  return <StatusPill tone={c.tone}>{c.label}</StatusPill>;
}

const submissionStatusConfig: Record<
  SubmissionStatus,
  { tone: "muted" | "warning" | "danger" | "success" | "navy" | "teal"; label: string }
> = {
  not_started: { tone: "muted", label: "Not started" },
  in_progress: { tone: "navy", label: "In progress" },
  submitted: { tone: "teal", label: "Submitted" },
  under_review: { tone: "navy", label: "Under review" },
  revision_requested: { tone: "warning", label: "Revision requested" },
  approved: { tone: "success", label: "Approved" },
  rejected: { tone: "danger", label: "Rejected" },
};

export function SubmissionStatusBadge({ status }: { status: SubmissionStatus }) {
  const c = submissionStatusConfig[status];
  return <StatusPill tone={c.tone}>{c.label}</StatusPill>;
}

const reviewStatusConfig: Record<
  ReviewStatus,
  { tone: "muted" | "warning" | "danger" | "success" | "navy" | "teal"; label: string }
> = {
  pending: { tone: "muted", label: "Pending" },
  approved: { tone: "success", label: "Approved" },
  revision_requested: { tone: "warning", label: "Revision requested" },
  rejected: { tone: "danger", label: "Rejected" },
};

export function ReviewStatusBadge({ status }: { status: ReviewStatus }) {
  const c = reviewStatusConfig[status];
  return <StatusPill tone={c.tone}>{c.label}</StatusPill>;
}

const publicationConfig: Record<
  PublicationStatus,
  { tone: "muted" | "warning" | "danger" | "success" | "navy" | "teal"; label: string }
> = {
  draft: { tone: "muted", label: "Draft" },
  published: { tone: "success", label: "Published" },
  archived: { tone: "danger", label: "Archived" },
};

export function PublicationBadge({ status }: { status: PublicationStatus }) {
  const c = publicationConfig[status];
  return <StatusPill tone={c.tone}>{c.label}</StatusPill>;
}

/** Compact "overdue" pill used in tables. */
export function OverdueBadge() {
  return <StatusPill tone="danger">Overdue</StatusPill>;
}

export function LateBadge() {
  return (
    <Badge
      variant="outline"
      className="border-warning/30 bg-warning/10 text-[11px] font-medium text-warning"
    >
      Late
    </Badge>
  );
}
