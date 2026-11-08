import { StatusPill } from "@/components/status-pill";
import { Badge } from "@/components/ui/badge";
import type {
  BlockerPriority,
  BlockerStatus,
  NotificationType,
  PublicationStatus,
} from "@/types/database";
import {
  ClipboardList,
  Megaphone,
  CalendarClock,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  type LucideIcon,
} from "lucide-react";

// ────────────────────────────────────────────────────────────────────────────
// Blocker badges
// ────────────────────────────────────────────────────────────────────────────

const blockerStatusConfig: Record<
  BlockerStatus,
  { tone: "muted" | "warning" | "success" | "navy" | "teal" | "danger"; label: string }
> = {
  open: { tone: "warning", label: "Open" },
  being_addressed: { tone: "navy", label: "Being addressed" },
  resolved: { tone: "success", label: "Resolved" },
};

export function BlockerStatusBadge({ status }: { status: BlockerStatus }) {
  const c = blockerStatusConfig[status];
  return <StatusPill tone={c.tone}>{c.label}</StatusPill>;
}

const blockerPriorityConfig: Record<
  BlockerPriority,
  { tone: "muted" | "warning" | "danger" | "navy" | "teal" | "success"; label: string }
> = {
  low: { tone: "muted", label: "Low" },
  medium: { tone: "teal", label: "Medium" },
  high: { tone: "warning", label: "High" },
  critical: { tone: "danger", label: "Critical" },
};

export function BlockerPriorityBadge({ priority }: { priority: BlockerPriority }) {
  const c = blockerPriorityConfig[priority];
  return <StatusPill tone={c.tone}>{c.label}</StatusPill>;
}

// ────────────────────────────────────────────────────────────────────────────
// Announcement badges
// ────────────────────────────────────────────────────────────────────────────

const announcementStatusConfig: Record<
  PublicationStatus,
  { tone: "muted" | "warning" | "success" | "danger" | "navy" | "teal"; label: string }
> = {
  draft: { tone: "muted", label: "Draft" },
  published: { tone: "success", label: "Published" },
  archived: { tone: "danger", label: "Archived" },
};

export function AnnouncementStatusBadge({ status }: { status: PublicationStatus }) {
  const c = announcementStatusConfig[status];
  return <StatusPill tone={c.tone}>{c.label}</StatusPill>;
}

export function PinnedBadge() {
  return (
    <Badge
      variant="outline"
      className="border-primary/30 bg-primary/10 text-[11px] font-medium text-primary"
    >
      Pinned
    </Badge>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Notification icon + label helpers
// ────────────────────────────────────────────────────────────────────────────

const notificationConfig: Record<
  NotificationType,
  {
    icon: LucideIcon;
    label: string;
    tone: "muted" | "warning" | "danger" | "success" | "navy" | "teal";
  }
> = {
  new_assignment: { icon: ClipboardList, label: "New assignment", tone: "navy" },
  deadline_approaching: {
    icon: CalendarClock,
    label: "Deadline approaching",
    tone: "warning",
  },
  submission_reviewed: {
    icon: CheckCircle2,
    label: "Submission reviewed",
    tone: "success",
  },
  revision_requested: {
    icon: RefreshCw,
    label: "Revision requested",
    tone: "warning",
  },
  new_announcement: { icon: Megaphone, label: "Announcement", tone: "teal" },
  weekly_report_due: { icon: CalendarClock, label: "Weekly report due", tone: "warning" },
  blocker_updated: { icon: AlertCircle, label: "Blocker updated", tone: "navy" },
};

export function notificationIcon(type: NotificationType): LucideIcon {
  return notificationConfig[type]?.icon ?? AlertCircle;
}

export function notificationLabel(type: NotificationType): string {
  return notificationConfig[type]?.label ?? "Notification";
}
