"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ChevronDown,
  ChevronRight,
  Circle,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  PhaseStatusBadge,
  WeekStatusBadge,
  PublicationStatusBadge,
  DifficultyBadge,
  ResourceTypeBadge,
} from "@/features/roadmap/status-badges";
import {
  savePhaseAction,
  saveWeekAction,
  saveTopicAction,
  saveResourceAction,
  deletePhaseAction,
  deleteWeekAction,
  deleteTopicAction,
  deleteResourceAction,
  publishPhaseAction,
  publishWeekAction,
  publishTopicAction,
  type RoadmapActionResult,
} from "@/features/roadmap/actions";
import {
  savePhaseSchema,
  saveWeekSchema,
  saveTopicSchema,
  saveResourceSchema,
  type SavePhaseValues,
  type SaveWeekValues,
  type SaveTopicValues,
  type SaveResourceValues,
} from "@/features/roadmap/schemas";
import type {
  LearningResource,
  Phase,
  Topic,
  Week,
  PhaseStatus,
  WeekStatus,
  PublicationStatus,
  TopicDifficulty,
  ResourceType,
} from "@/types/database";

// ────────────────────────────── Helpers ──────────────────────────────
function linesToArray(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}
function arrayToLines(arr: string[] | null | undefined): string {
  return (arr ?? []).join("\n");
}
function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Spread these onto a `<Input type="number">` to coerce the string event back
 * into a number for react-hook-form. Required number fields use `undefined`
 * for empty (so zod reports "Required"); optional/nullable fields use `null`.
 */
function reqIntProps(field: {
  value: number;
  onChange: (v: number | undefined) => void;
}) {
  return {
    value: field.value,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      field.onChange(e.target.value === "" ? undefined : Number(e.target.value)),
  };
}
function optIntProps(field: {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
}) {
  return {
    value: field.value ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      field.onChange(e.target.value === "" ? null : Number(e.target.value)),
  };
}

interface ManagerProps {
  phases: Phase[];
  weeks: Week[];
  topics: Topic[];
  resources: LearningResource[];
}

type DialogState =
  | { kind: "phase"; mode: "create" }
  | { kind: "phase"; mode: "edit"; entity: Phase }
  | { kind: "week"; mode: "create"; phaseId: string }
  | { kind: "week"; mode: "edit"; entity: Week }
  | { kind: "topic"; mode: "create"; weekId: string }
  | { kind: "topic"; mode: "edit"; entity: Topic }
  | null;

type DeleteState =
  | {
      kind: "phase" | "week" | "topic" | "resource";
      id: string;
      title: string;
      warning: string;
    }
  | null;

export function RoadmapManager({
  phases,
  weeks,
  topics,
  resources,
}: ManagerProps) {
  const router = useRouter();
  const [dialog, setDialog] = React.useState<DialogState>(null);
  const [del, setDel] = React.useState<DeleteState>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      {/* Top: New phase */}
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-muted-foreground">
          <span className="nums font-medium text-foreground">{phases.length}</span>
          {phases.length === 1 ? " phase" : " phases"} ·{" "}
          <span className="nums font-medium text-foreground">{weeks.length}</span>
          {weeks.length === 1 ? " week" : " weeks"} ·{" "}
          <span className="nums font-medium text-foreground">{topics.length}</span>
          {topics.length === 1 ? " topic" : " topics"}
        </p>
        <Button size="sm" onClick={() => setDialog({ kind: "phase", mode: "create" })}>
          <Plus className="size-4" />
          New phase
        </Button>
      </div>

      {phases.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <p className="text-[14px] font-medium">No phases yet</p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Create your first phase to start building the curriculum.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {phases.map((phase) => (
            <PhaseBlock
              key={phase.id}
              phase={phase}
              weeks={weeks.filter((w) => w.phase_id === phase.id)}
              topics={topics}
              resources={resources}
              onEdit={() =>
                setDialog({ kind: "phase", mode: "edit", entity: phase })
              }
              onTogglePublish={(status) =>
                runAction(
                  () => publishPhaseAction({ id: phase.id, status }),
                  "Phase status updated.",
                )
              }
              onDelete={() =>
                setDel({
                  kind: "phase",
                  id: phase.id,
                  title: phase.title,
                  warning:
                    "Deleting a phase cascades to all of its weeks, topics, resources, and topic_progress. This cannot be undone.",
                })
              }
              onNewWeek={() =>
                setDialog({ kind: "week", mode: "create", phaseId: phase.id })
              }
              onEditWeek={(w) =>
                setDialog({ kind: "week", mode: "edit", entity: w })
              }
              onToggleWeekPublish={(w, status) =>
                runAction(
                  () => publishWeekAction({ id: w.id, status }),
                  "Week status updated.",
                )
              }
              onDeleteWeek={(w) =>
                setDel({
                  kind: "week",
                  id: w.id,
                  title: w.title,
                  warning:
                    "Deleting a week cascades to all of its topics, resources, and topic_progress.",
                })
              }
              onNewTopic={(weekId) =>
                setDialog({ kind: "topic", mode: "create", weekId })
              }
              onEditTopic={(t) =>
                setDialog({ kind: "topic", mode: "edit", entity: t })
              }
              onToggleTopicPublish={(t, status) =>
                runAction(
                  () => publishTopicAction({ id: t.id, status }),
                  "Topic status updated.",
                )
              }
              onDeleteTopic={(t) =>
                setDel({
                  kind: "topic",
                  id: t.id,
                  title: t.title,
                  warning:
                    "Deleting a topic removes its resources and any member progress recorded for it.",
                })
              }
              onDeleteResource={(r) =>
                setDel({
                  kind: "resource",
                  id: r.id,
                  title: r.title,
                  warning: "This removes the resource from the topic.",
                })
              }
            />
          ))}
        </div>
      )}

      {/* Dialogs */}
      {dialog?.kind === "phase" ? (
        <PhaseFormDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          mode={dialog.mode}
          entity={dialog.mode === "edit" ? dialog.entity : undefined}
          defaultDisplayOrder={phases.length + 1}
          defaultPhaseNumber={phases.length + 1}
        />
      ) : null}
      {dialog?.kind === "week" ? (
        <WeekFormDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          mode={dialog.mode}
          entity={dialog.mode === "edit" ? dialog.entity : undefined}
          phaseId={dialog.mode === "create" ? dialog.phaseId : dialog.entity.phase_id}
          defaultWeekNumber={Math.max(0, ...weeks.map((w) => w.week_number)) + 1}
        />
      ) : null}
      {dialog?.kind === "topic" ? (
        <TopicFormDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          mode={dialog.mode}
          entity={dialog.mode === "edit" ? dialog.entity : undefined}
          weekId={dialog.mode === "create" ? dialog.weekId : dialog.entity.week_id}
        />
      ) : null}

      {/* Delete confirmation */}
      <DeleteConfirmDialog
        state={del}
        pending={pending}
        onClose={() => setDel(null)}
        onConfirm={() => {
          if (!del) return;
          const { kind, id } = del;
          const action =
            kind === "phase"
              ? deletePhaseAction
              : kind === "week"
                ? deleteWeekAction
                : kind === "topic"
                  ? deleteTopicAction
                  : deleteResourceAction;
          runAction(() => action({ id }), `${kind} deleted.`, () => setDel(null));
        }}
      />
    </div>
  );

  function runAction(
    fn: () => Promise<RoadmapActionResult>,
    success: string,
    onDone?: () => void,
  ) {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(success);
        router.refresh();
      } else if (!res.ok) {
        toast.error(res.error ?? "Action failed.");
      }
      onDone?.();
    });
  }
}

// Pull router into the hook scope.
function useRouterRefresh() {
  const router = useRouter();
  return React.useCallback(() => router.refresh(), [router]);
}

// ────────────────────────────── Phase block ──────────────────────────────
interface PhaseBlockProps {
  phase: Phase;
  weeks: Week[];
  topics: Topic[];
  resources: LearningResource[];
  onEdit: () => void;
  onTogglePublish: (status: PhaseStatus) => void;
  onDelete: () => void;
  onNewWeek: () => void;
  onEditWeek: (w: Week) => void;
  onToggleWeekPublish: (w: Week, status: WeekStatus) => void;
  onDeleteWeek: (w: Week) => void;
  onNewTopic: (weekId: string) => void;
  onEditTopic: (t: Topic) => void;
  onToggleTopicPublish: (t: Topic, status: PublicationStatus) => void;
  onDeleteTopic: (t: Topic) => void;
  onDeleteResource: (r: LearningResource) => void;
}

function PhaseBlock(props: PhaseBlockProps) {
  const { phase, weeks } = props;
  const [open, setOpen] = React.useState(true);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <button
              className="mt-0.5 text-muted-foreground hover:text-foreground"
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? "Collapse phase" : "Expand phase"}
            >
              {open ? (
                <ChevronDown className="size-4" />
              ) : (
                <ChevronRight className="size-4" />
              )}
            </button>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="nums text-[12px] font-semibold text-muted-foreground">
                  P{phase.phase_number}
                </span>
                <CardTitle className="text-[15px]">{phase.title}</CardTitle>
                <PhaseStatusBadge status={phase.status} />
              </div>
              {phase.description ? (
                <p className="text-[13px] leading-relaxed text-muted-foreground">
                  {phase.description}
                </p>
              ) : null}
              <p className="text-[12px] text-muted-foreground">
                Weeks {phase.start_week}–{phase.end_week} · {weeks.length}{" "}
                {weeks.length === 1 ? "week" : "weeks"}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={props.onEdit}
              aria-label="Edit phase"
            >
              <Pencil className="size-3.5" />
              Edit
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                props.onTogglePublish(
                  phase.status === "published" ? "draft" : "published",
                )
              }
            >
              {phase.status === "published" ? "Unpublish" : "Publish"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={props.onDelete}
              aria-label="Delete phase"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>

      {open ? (
        <CardContent className="space-y-3 pt-0">
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="ghost"
              onClick={props.onNewWeek}
            >
              <Plus className="size-3.5" />
              New week
            </Button>
          </div>
          {weeks.length === 0 ? (
            <p className="rounded-md border border-dashed border-border p-4 text-center text-[13px] text-muted-foreground">
              No weeks in this phase yet.
            </p>
          ) : (
            <div className="space-y-3">
              {weeks.map((week) => (
                <WeekBlock
                  key={week.id}
                  phase={phase}
                  week={week}
                  topics={props.topics.filter((t) => t.week_id === week.id)}
                  resources={props.resources}
                  onEdit={() => props.onEditWeek(week)}
                  onTogglePublish={(status) =>
                    props.onToggleWeekPublish(week, status)
                  }
                  onDelete={() => props.onDeleteWeek(week)}
                  onNewTopic={() => props.onNewTopic(week.id)}
                  onEditTopic={props.onEditTopic}
                  onToggleTopicPublish={props.onToggleTopicPublish}
                  onDeleteTopic={props.onDeleteTopic}
                  onDeleteResource={props.onDeleteResource}
                />
              ))}
            </div>
          )}
        </CardContent>
      ) : null}
    </Card>
  );
}

// ────────────────────────────── Week block ──────────────────────────────
interface WeekBlockProps {
  phase: Phase;
  week: Week;
  topics: Topic[];
  resources: LearningResource[];
  onEdit: () => void;
  onTogglePublish: (status: WeekStatus) => void;
  onDelete: () => void;
  onNewTopic: () => void;
  onEditTopic: (t: Topic) => void;
  onToggleTopicPublish: (t: Topic, status: PublicationStatus) => void;
  onDeleteTopic: (t: Topic) => void;
  onDeleteResource: (r: LearningResource) => void;
}

function WeekBlock(props: WeekBlockProps) {
  const { week, topics } = props;
  const [open, setOpen] = React.useState(true);

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <button
            className="mt-0.5 text-muted-foreground hover:text-foreground"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Collapse week" : "Expand week"}
          >
            {open ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )}
          </button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="nums text-[12px] font-semibold text-muted-foreground">
                W{week.week_number}
              </span>
              <span className="text-[14px] font-medium text-foreground">
                {week.title}
              </span>
              <WeekStatusBadge status={week.status} />
            </div>
            {week.overview ? (
              <p className="mt-0.5 line-clamp-1 text-[12px] text-muted-foreground">
                {week.overview}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={props.onEdit}>
            <Pencil className="size-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            onClick={() =>
              props.onTogglePublish(
                week.status === "published" ? "draft" : "published",
              )
            }
          >
            {week.status === "published" ? "Unpublish" : "Publish"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-destructive hover:text-destructive"
            onClick={props.onDelete}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      {open ? (
        <div className="mt-3 space-y-2 pl-6">
          <div className="flex justify-end">
            <Button size="sm" variant="ghost" className="h-7" onClick={props.onNewTopic}>
              <Plus className="size-3.5" />
              New topic
            </Button>
          </div>
          {topics.length === 0 ? (
            <p className="rounded-md border border-dashed border-border bg-card p-3 text-center text-[12px] text-muted-foreground">
              No topics in this week yet.
            </p>
          ) : (
            <div className="space-y-2">
              {topics.map((topic) => (
                <TopicRow
                  key={topic.id}
                  topic={topic}
                  resources={props.resources.filter(
                    (r) => r.topic_id === topic.id,
                  )}
                  onEdit={() => props.onEditTopic(topic)}
                  onTogglePublish={(status) =>
                    props.onToggleTopicPublish(topic, status)
                  }
                  onDelete={() => props.onDeleteTopic(topic)}
                  onDeleteResource={props.onDeleteResource}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ────────────────────────────── Topic row ──────────────────────────────
interface TopicRowProps {
  topic: Topic;
  resources: LearningResource[];
  onEdit: () => void;
  onTogglePublish: (status: PublicationStatus) => void;
  onDelete: () => void;
  onDeleteResource: (r: LearningResource) => void;
}

function TopicRow(props: TopicRowProps) {
  const { topic, resources } = props;
  const [showResources, setShowResources] = React.useState(false);
  const [editingResourceId, setEditingResourceId] = React.useState<string | null>(null);

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <Circle className="mt-1 size-3 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[14px] font-medium text-foreground">
                {topic.title}
              </span>
              <DifficultyBadge difficulty={topic.difficulty} />
              <PublicationStatusBadge status={topic.publication_status} />
              {topic.estimated_minutes ? (
                <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
                  {topic.estimated_minutes} min
                </Badge>
              ) : null}
            </div>
            {topic.description ? (
              <p className="mt-0.5 line-clamp-1 text-[12px] text-muted-foreground">
                {topic.description}
              </p>
            ) : null}
            <button
              className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
              onClick={() => setShowResources((v) => !v)}
            >
              {showResources ? (
                <ChevronDown className="size-3" />
              ) : (
                <ChevronRight className="size-3" />
              )}
              {resources.length}{" "}
              {resources.length === 1 ? "resource" : "resources"}
            </button>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={props.onEdit}>
            <Pencil className="size-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            onClick={() =>
              props.onTogglePublish(
                topic.publication_status === "published" ? "draft" : "published",
              )
            }
          >
            {topic.publication_status === "published" ? "Unpublish" : "Publish"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-destructive hover:text-destructive"
            onClick={props.onDelete}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      {showResources ? (
        <div className="mt-3 border-t border-border pt-3 pl-5">
          {!editingResourceId ? <ResourceInlineForm topicId={topic.id} /> : null}
          {resources.length > 0 ? (
            <ul className="mt-3 space-y-1.5">
              {resources.map((r) => (
                <li key={r.id}>
                  {editingResourceId === r.id ? (
                    <ResourceInlineForm
                      topicId={topic.id}
                      resource={r}
                      onCancel={() => setEditingResourceId(null)}
                      onSaved={() => setEditingResourceId(null)}
                    />
                  ) : (
                    <div className="flex items-center gap-2 rounded-md border border-border p-2">
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex min-w-0 flex-1 items-center gap-1.5 text-[13px] font-medium text-foreground hover:underline"
                      >
                        <span className="truncate">{r.title}</span>
                        <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
                      </a>
                      <ResourceTypeBadge type={r.resource_type} />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-1.5"
                        onClick={() => setEditingResourceId(r.id)}
                        aria-label={`Edit ${r.title}`}
                      >
                        <Pencil className="size-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-1.5 text-destructive hover:text-destructive"
                        onClick={() => props.onDeleteResource(r)}
                        aria-label={`Delete ${r.title}`}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[12px] text-muted-foreground">
              No resources yet.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ────────────────────────────── Inline resource form ──────────────────────────────
function ResourceInlineForm({
  topicId,
  resource,
  onCancel,
  onSaved,
}: {
  topicId: string;
  resource?: LearningResource;
  onCancel?: () => void;
  onSaved?: () => void;
}) {
  const refresh = useRouterRefresh();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = React.useState(resource?.title ?? "");
  const [url, setUrl] = React.useState(resource?.url ?? "");
  const [description, setDescription] = React.useState(resource?.description ?? "");
  const [resourceType, setResourceType] = React.useState<ResourceType>(resource?.resource_type ?? "documentation");
  const [isFree, setIsFree] = React.useState(resource?.is_free ?? true);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const values: SaveResourceValues = {
      id: resource?.id,
      topicId,
      title,
      url,
      resourceType,
      description,
      isFree,
      displayOrder: resource?.display_order ?? 0,
      difficulty: resource?.difficulty ?? null,
    };
    startTransition(async () => {
      const parsed = saveResourceSchema.safeParse(values);
      if (!parsed.success) {
        toast.error(parsed.error.issues[0]?.message ?? "Invalid input.");
        return;
      }
      const res = await saveResourceAction(parsed.data);
      if (res.ok) {
        toast.success(resource ? "Resource updated." : "Resource added.");
        if (!resource) {
          setTitle("");
          setUrl("");
          setDescription("");
        }
        onSaved?.();
        refresh();
      } else if (!res.ok) {
        toast.error(res.error);
      }
    });
  };

  return (
    <form
      onSubmit={submit}
      className="grid gap-2 rounded-md border border-dashed border-border bg-muted/30 p-2 sm:grid-cols-[1fr_1fr_auto_auto_auto_auto]"
    >
      <Input
        className="h-8"
        placeholder="Resource title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />
      <Textarea
        className="min-h-8 resize-y text-sm sm:col-span-2"
        placeholder="Optional resource description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
      />
      <Input
        className="h-8"
        placeholder="https://…"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        required
      />
      <Select value={resourceType} onValueChange={(v) => setResourceType(v as ResourceType)}>
        <SelectTrigger size="sm" className="h-8 w-[120px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(["article", "video", "book", "documentation", "course", "tool", "other"] as ResourceType[]).map(
            (t) => (
              <SelectItem key={t} value={t} className="capitalize">
                {t}
              </SelectItem>
            ),
          )}
        </SelectContent>
      </Select>
      <Button
        type="button"
        size="sm"
        variant={isFree ? "secondary" : "outline"}
        className="h-8"
        onClick={() => setIsFree((v) => !v)}
      >
        {isFree ? "Free" : "Paid"}
      </Button>
      <Button type="submit" size="sm" className="h-8" disabled={pending}>
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
        {resource ? "Save" : "Add"}
      </Button>
      {resource && onCancel ? (
        <Button type="button" size="sm" variant="outline" className="h-8" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
      ) : null}
    </form>
  );
}

// ────────────────────────────── Phase form dialog ──────────────────────────────
interface PhaseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  entity?: Phase;
  defaultDisplayOrder: number;
  defaultPhaseNumber: number;
}

function PhaseFormDialog(props: PhaseFormDialogProps) {
  const refresh = useRouterRefresh();
  const [pending, startTransition] = useTransition();
  const defaults: SavePhaseValues = props.entity
    ? {
        id: props.entity.id,
        title: props.entity.title,
        slug: props.entity.slug,
        description: props.entity.description ?? "",
        phaseNumber: props.entity.phase_number,
        startWeek: props.entity.start_week,
        endWeek: props.entity.end_week,
        status: props.entity.status,
        displayOrder: props.entity.display_order,
      }
    : {
        title: "",
        slug: "",
        description: "",
        phaseNumber: props.defaultPhaseNumber,
        startWeek: props.defaultPhaseNumber,
        endWeek: props.defaultPhaseNumber + 3,
        status: "draft",
        displayOrder: props.defaultDisplayOrder,
      };

  const form = useForm<SavePhaseValues>({
    resolver: zodResolver(savePhaseSchema),
    defaultValues: defaults,
  });

  const onSubmit = (values: SavePhaseValues) => {
    startTransition(async () => {
      const res = await savePhaseAction(values);
      if (res.ok) {
        toast.success(props.mode === "create" ? "Phase created." : "Phase saved.");
        props.onOpenChange(false);
        refresh();
      } else if (!res.ok) {
        toast.error(res.error);
      }
    });
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {props.mode === "create" ? "New phase" : "Edit phase"}
          </DialogTitle>
          <DialogDescription>
            A phase groups several weeks of the curriculum together.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            id="phase-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[13px]">Title</FormLabel>
                  <FormControl>
                    <Input className="h-9" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[13px]">Slug</FormLabel>
                  <FormControl>
                    <Input
                      className="h-9"
                      {...field}
                      placeholder="e.g. python-fundamentals"
                    />
                  </FormControl>
                  <FormDescription className="text-[12px]">
                    Lowercase, hyphen-separated. Must be unique per team.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[13px]">Description</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      className="resize-none"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-3 gap-3">
              <FormField
                control={form.control}
                name="phaseNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[13px]">Phase #</FormLabel>
                    <FormControl>
                      <Input className="h-9" type="number" min={1} {...field} {...reqIntProps(field)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="startWeek"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[13px]">Start week</FormLabel>
                    <FormControl>
                      <Input className="h-9" type="number" min={1} {...field} {...reqIntProps(field)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endWeek"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[13px]">End week</FormLabel>
                    <FormControl>
                      <Input className="h-9" type="number" min={1} {...field} {...reqIntProps(field)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[13px]">Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(["draft", "published", "archived"] as PhaseStatus[]).map((s) => (
                          <SelectItem key={s} value={s} className="capitalize">
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="displayOrder"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[13px]">Display order</FormLabel>
                    <FormControl>
                      <Input className="h-9" type="number" min={0} {...field} {...reqIntProps(field)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </form>
        </Form>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => props.onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button type="submit" form="phase-form" disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            {props.mode === "create" ? "Create phase" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ────────────────────────────── Week form dialog ──────────────────────────────
interface WeekFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  entity?: Week;
  phaseId: string;
  defaultWeekNumber: number;
}

function WeekFormDialog(props: WeekFormDialogProps) {
  const refresh = useRouterRefresh();
  const [pending, startTransition] = useTransition();
  const defaults: SaveWeekValues = props.entity
    ? {
        id: props.entity.id,
        phaseId: props.entity.phase_id,
        title: props.entity.title,
        slug: props.entity.slug,
        overview: props.entity.overview ?? "",
        objectives: props.entity.objectives ?? [],
        deliverables: props.entity.deliverables ?? [],
        completionCriteria: props.entity.completion_criteria ?? [],
        weekNumber: props.entity.week_number,
        startDate: props.entity.start_date ?? "",
        endDate: props.entity.end_date ?? "",
        status: props.entity.status,
        displayOrder: props.entity.display_order,
      }
    : {
        phaseId: props.phaseId,
        title: "",
        slug: "",
        overview: "",
        objectives: [],
        deliverables: [],
        completionCriteria: [],
        weekNumber: props.defaultWeekNumber,
        startDate: "",
        endDate: "",
        status: "draft",
        displayOrder: props.defaultWeekNumber,
      };

  const form = useForm<SaveWeekValues>({
    resolver: zodResolver(saveWeekSchema),
    defaultValues: defaults,
  });

  const onSubmit = (values: SaveWeekValues) => {
    startTransition(async () => {
      const res = await saveWeekAction(values);
      if (res.ok) {
        toast.success(props.mode === "create" ? "Week created." : "Week saved.");
        props.onOpenChange(false);
        refresh();
      } else if (!res.ok) {
        toast.error(res.error);
      }
    });
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {props.mode === "create" ? "New week" : "Edit week"}
          </DialogTitle>
          <DialogDescription>
            A week holds objectives, deliverables, and topics.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            id="week-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <div className="grid gap-3 sm:grid-cols-[2fr_1fr_auto]">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[13px]">Title</FormLabel>
                    <FormControl>
                      <Input className="h-9" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="weekNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[13px]">Week #</FormLabel>
                    <FormControl>
                      <Input className="h-9" type="number" min={1} {...field} {...reqIntProps(field)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[13px]">Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(["draft", "published", "archived"] as WeekStatus[]).map((s) => (
                          <SelectItem key={s} value={s} className="capitalize">
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[13px]">Slug</FormLabel>
                  <FormControl>
                    <Input className="h-9" {...field} placeholder="e.g. introduction-to-python" />
                  </FormControl>
                  <FormDescription className="text-[12px]">
                    Lowercase, hyphen-separated. Unique per team.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="overview"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[13px]">Overview</FormLabel>
                  <FormControl>
                    <Textarea rows={3} className="resize-none" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-3 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="objectives"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[13px]">Objectives</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={5}
                        className="resize-none font-mono text-[12px]"
                        value={arrayToLines(field.value)}
                        onChange={(e) => field.onChange(linesToArray(e.target.value))}
                        placeholder="One per line"
                      />
                    </FormControl>
                    <FormDescription className="text-[12px]">One per line.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="deliverables"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[13px]">Deliverables</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={5}
                        className="resize-none font-mono text-[12px]"
                        value={arrayToLines(field.value)}
                        onChange={(e) => field.onChange(linesToArray(e.target.value))}
                        placeholder="One per line"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="completionCriteria"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[13px]">Completion criteria</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={5}
                        className="resize-none font-mono text-[12px]"
                        value={arrayToLines(field.value)}
                        onChange={(e) => field.onChange(linesToArray(e.target.value))}
                        placeholder="One per line"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[13px]">Start date</FormLabel>
                    <FormControl>
                      <Input className="h-9" type="date" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[13px]">End date</FormLabel>
                    <FormControl>
                      <Input className="h-9" type="date" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="displayOrder"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[13px]">Display order</FormLabel>
                    <FormControl>
                      <Input className="h-9" type="number" min={0} {...field} {...reqIntProps(field)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </form>
        </Form>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => props.onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button type="submit" form="week-form" disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            {props.mode === "create" ? "Create week" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ────────────────────────────── Topic form dialog ──────────────────────────────
interface TopicFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  entity?: Topic;
  weekId: string;
}

function TopicFormDialog(props: TopicFormDialogProps) {
  const refresh = useRouterRefresh();
  const [pending, startTransition] = useTransition();
  const defaults: SaveTopicValues = props.entity
    ? {
        id: props.entity.id,
        weekId: props.entity.week_id,
        title: props.entity.title,
        slug: props.entity.slug,
        description: props.entity.description ?? "",
        learningObjectives: props.entity.learning_objectives ?? [],
        prerequisites: props.entity.prerequisites ?? [],
        completionCriteria: props.entity.completion_criteria ?? [],
        practicalExercise: props.entity.practical_exercise ?? "",
        estimatedMinutes: props.entity.estimated_minutes ?? null,
        difficulty: props.entity.difficulty,
        publicationStatus: props.entity.publication_status,
        displayOrder: props.entity.display_order,
      }
    : {
        weekId: props.weekId,
        title: "",
        slug: "",
        description: "",
        learningObjectives: [],
        prerequisites: [],
        completionCriteria: [],
        practicalExercise: "",
        estimatedMinutes: null,
        difficulty: "beginner",
        publicationStatus: "published",
        displayOrder: 0,
      };

  const form = useForm<SaveTopicValues>({
    resolver: zodResolver(saveTopicSchema),
    defaultValues: defaults,
  });

  const onSubmit = (values: SaveTopicValues) => {
    startTransition(async () => {
      const res = await saveTopicAction(values);
      if (res.ok) {
        toast.success(props.mode === "create" ? "Topic created." : "Topic saved.");
        props.onOpenChange(false);
        refresh();
      } else if (!res.ok) {
        toast.error(res.error);
      }
    });
  };

  // Auto-slug from title while creating (only when slug is empty, so a
  // manually-edited slug is preserved).
  const title = useWatch({ control: form.control, name: "title" });
  React.useEffect(() => {
    if (props.mode === "create") {
      const currentSlug = form.getValues("slug");
      if (!currentSlug) {
        form.setValue("slug", slugify(title));
      }
    }
  }, [title, form, props.mode]);

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {props.mode === "create" ? "New topic" : "Edit topic"}
          </DialogTitle>
          <DialogDescription>
            Topics are the smallest learning unit. Members mark them started/completed.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            id="topic-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[13px]">Title</FormLabel>
                    <FormControl>
                      <Input className="h-9" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[13px]">Slug</FormLabel>
                    <FormControl>
                      <Input className="h-9" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[13px]">Description</FormLabel>
                  <FormControl>
                    <Textarea rows={2} className="resize-none" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-3 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="learningObjectives"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[13px]">Learning objectives</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={6}
                        className="resize-none font-mono text-[12px]"
                        value={arrayToLines(field.value)}
                        onChange={(e) => field.onChange(linesToArray(e.target.value))}
                        placeholder="One per line"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="prerequisites"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[13px]">Prerequisites</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={6}
                        className="resize-none font-mono text-[12px]"
                        value={arrayToLines(field.value)}
                        onChange={(e) => field.onChange(linesToArray(e.target.value))}
                        placeholder="One per line"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="completionCriteria"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[13px]">Completion criteria</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={6}
                        className="resize-none font-mono text-[12px]"
                        value={arrayToLines(field.value)}
                        onChange={(e) => field.onChange(linesToArray(e.target.value))}
                        placeholder="One per line"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="practicalExercise"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[13px]">Practical exercise</FormLabel>
                  <FormControl>
                    <Textarea rows={3} className="resize-none" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <FormField
                control={form.control}
                name="difficulty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[13px]">Difficulty</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(["beginner", "intermediate", "advanced"] as TopicDifficulty[]).map((d) => (
                          <SelectItem key={d} value={d} className="capitalize">
                            {d}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="estimatedMinutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[13px]">Est. minutes</FormLabel>
                    <FormControl>
                      <Input
                        className="h-9"
                        type="number"
                        min={1}
                        {...field}
                        {...optIntProps(field)}
                      />
                    </FormControl>
                    <FormDescription className="text-[12px]">Optional</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="publicationStatus"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[13px]">Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(["draft", "published", "archived"] as PublicationStatus[]).map((s) => (
                          <SelectItem key={s} value={s} className="capitalize">
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="displayOrder"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[13px]">Order</FormLabel>
                    <FormControl>
                      <Input className="h-9" type="number" min={0} {...field} {...reqIntProps(field)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </form>
        </Form>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => props.onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button type="submit" form="topic-form" disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            {props.mode === "create" ? "Create topic" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ────────────────────────────── Delete confirmation ──────────────────────────────
interface DeleteConfirmDialogProps {
  state: DeleteState;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

function DeleteConfirmDialog({
  state,
  pending,
  onClose,
  onConfirm,
}: DeleteConfirmDialogProps) {
  return (
    <AlertDialog open={state !== null} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        {state ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="capitalize">
                Delete {state.kind}
              </AlertDialogTitle>
              <AlertDialogDescription>
                <span className="block font-medium text-foreground">
                  {state.title}
                </span>
                <span className="mt-1 block">{state.warning}</span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  onConfirm();
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={pending}
              >
                {pending ? <Loader2 className="size-4 animate-spin" /> : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        ) : null}
      </AlertDialogContent>
    </AlertDialog>
  );
}
