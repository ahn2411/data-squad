"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Save, Send, ArrowLeft, X, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
  createAssignmentSchema,
  ASSIGNMENT_TYPES,
  ASSIGNMENT_DIFFICULTIES,
  SUBMISSION_TYPES,
  type CreateAssignmentValues,
  type UpdateAssignmentValues,
} from "@/features/assignments/schemas";
import {
  createAssignmentAction,
  updateAssignmentAction,
  publishAssignmentAction,
} from "@/features/assignments/actions";
import type {
  Assignment,
  AssignmentType,
  AssignmentDifficulty,
  SubmissionType,
  PublicationStatus,
} from "@/types/database";
import type { PhaseOption } from "./new/queries";

interface AssignmentFormProps {
  mode: "create" | "edit";
  assignment?: Assignment;
  selectedRecipientIds?: string[];
  members: Array<{ id: string; name: string }>;
  phases: PhaseOption[];
}

/**
 * A single form-schema that adds an optional `id` to the create schema and
 * removes `.default()` on the jsonb string-array fields and enum fields so the
 * form's input and output types match (zodResolver expects TFieldValues =
 * input type; with `.default()` the input type allows undefined, breaking the
 * `Control<TFieldValues>` shape).
 */
const formSchema = createAssignmentSchema
  .extend({
    id: z.string().uuid().optional(),
    supporting_resources: z.array(z.string().max(500)).max(50),
    deliverables: z.array(z.string().max(500)).max(50),
    evaluation_criteria: z.array(z.string().max(500)).max(50),
    recipientUserIds: z.array(z.string().uuid()),
    description: z.string().max(2000).optional().or(z.literal("")),
    instructions: z.string().max(8000).optional().or(z.literal("")),
    deadline: z.string().nullable().optional(),
    publication_status: z.enum([
      "draft",
      "published",
      "archived",
    ] as [PublicationStatus, ...PublicationStatus[]]),
  });
type FormValues = z.infer<typeof formSchema>;

const TYPE_LABELS: Record<AssignmentType, string> = {
  programming_exercise: "Programming exercise",
  written_explanation: "Written explanation",
  research_activity: "Research activity",
  data_analysis: "Data analysis",
  quiz: "Quiz",
  mini_project: "Mini project",
  group_project: "Group project",
};

const DIFFICULTY_LABELS: Record<AssignmentDifficulty, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

const SUBMISSION_TYPE_LABELS: Record<SubmissionType, string> = {
  github_repo: "GitHub repo URL",
  github_pr: "GitHub PR URL",
  github_commit: "GitHub commit URL",
  external_url: "External URL",
  written: "Written text",
  document: "Document upload",
  image: "Image upload",
  file: "File upload",
};

export function AssignmentForm({
  mode,
  assignment,
  selectedRecipientIds,
  members,
  phases,
}: AssignmentFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [resourceInput, setResourceInput] = React.useState("");
  const [deliverableInput, setDeliverableInput] = React.useState("");
  const [criteriaInput, setCriteriaInput] = React.useState("");
  const [allMembersToggle, setAllMembersToggle] = React.useState<boolean>(
    (selectedRecipientIds ?? []).length === 0,
  );
  const [publishOnSave, setPublishOnSave] = React.useState<boolean>(
    (assignment?.publication_status ?? "draft") === "published",
  );

  const isEdit = mode === "edit" && assignment;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      id: assignment?.id,
      title: assignment?.title ?? "",
      description: assignment?.description ?? "",
      instructions: assignment?.instructions ?? "",
      assignment_type: assignment?.assignment_type ?? "programming_exercise",
      difficulty: assignment?.difficulty ?? "beginner",
      phase_id: assignment?.phase_id ?? null,
      week_id: assignment?.week_id ?? null,
      topic_id: assignment?.topic_id ?? null,
      deadline: assignment?.deadline ?? "",
      max_score: assignment?.max_score ?? null,
      required_submission_type: assignment?.required_submission_type ?? null,
      supporting_resources: assignment?.supporting_resources ?? [],
      deliverables: assignment?.deliverables ?? [],
      evaluation_criteria: assignment?.evaluation_criteria ?? [],
      recipientUserIds: selectedRecipientIds ?? [],
      publication_status: assignment?.publication_status ?? "draft",
    },
  });

  // Sync allMembersToggle → recipientUserIds
  React.useEffect(() => {
    if (allMembersToggle) {
      form.setValue("recipientUserIds", []);
    }
  }, [allMembersToggle, form]);

  const recipients = useWatch({ control: form.control, name: "recipientUserIds" });
  const supportingResources = useWatch({ control: form.control, name: "supporting_resources" });
  const deliverables = useWatch({ control: form.control, name: "deliverables" });
  const evaluationCriteria = useWatch({ control: form.control, name: "evaluation_criteria" });

  const toggleRecipient = (id: string) => {
    const current = form.getValues("recipientUserIds");
    if (current.includes(id)) {
      form.setValue(
        "recipientUserIds",
        current.filter((r) => r !== id),
      );
    } else {
      form.setValue("recipientUserIds", [...current, id]);
    }
  };

  // List helpers (supporting_resources, deliverables, evaluation_criteria)
  const addResource = () => {
    const v = resourceInput.trim();
    if (!v) return;
    if (!/^https?:\/\/[^\s]+$/.test(v)) {
      toast.error("Add a valid URL starting with http(s)://");
      return;
    }
    const list = form.getValues("supporting_resources");
    if (list.includes(v)) {
      toast.error("That URL is already in the list.");
      return;
    }
    form.setValue("supporting_resources", [...list, v]);
    setResourceInput("");
  };
  const removeResource = (idx: number) => {
    const list = form.getValues("supporting_resources");
    form.setValue(
      "supporting_resources",
      list.filter((_, i) => i !== idx),
    );
  };

  const addDeliverable = () => {
    const v = deliverableInput.trim();
    if (!v) return;
    const list = form.getValues("deliverables");
    if (list.includes(v)) {
      toast.error("That deliverable is already in the list.");
      return;
    }
    form.setValue("deliverables", [...list, v]);
    setDeliverableInput("");
  };
  const removeDeliverable = (idx: number) => {
    const list = form.getValues("deliverables");
    form.setValue(
      "deliverables",
      list.filter((_, i) => i !== idx),
    );
  };

  const addCriterion = () => {
    const v = criteriaInput.trim();
    if (!v) return;
    const list = form.getValues("evaluation_criteria");
    if (list.includes(v)) {
      toast.error("That criterion is already in the list.");
      return;
    }
    form.setValue("evaluation_criteria", [...list, v]);
    setCriteriaInput("");
  };
  const removeCriterion = (idx: number) => {
    const list = form.getValues("evaluation_criteria");
    form.setValue(
      "evaluation_criteria",
      list.filter((_, i) => i !== idx),
    );
  };

  const selectedPhaseId = useWatch({ control: form.control, name: "phase_id" });
  const selectedPhase = phases.find((p) => p.id === selectedPhaseId);

  const onSubmit = (values: FormValues) => {
    // Strip the optional `id` for create payloads.
    const { id: _id, ...rest } = values;
    void _id;

    // Apply publish toggle: override publication_status.
    const valuesWithPublish = {
      ...rest,
      publication_status: (publishOnSave ? "published" : "draft") as PublicationStatus,
    };

    // Normalize empty deadline string → null (the schema accepts "" but we want
    // a clean null in the DB).
    if (valuesWithPublish.deadline === "") {
      valuesWithPublish.deadline = null;
    }

    startTransition(async () => {
      if (isEdit && assignment) {
        const updateValues: UpdateAssignmentValues = {
          ...valuesWithPublish,
          id: assignment.id,
        };
        const res = await updateAssignmentAction(updateValues);
        if (res.ok) {
          toast.success(publishOnSave ? "Assignment published." : "Assignment saved.");
          if (res.redirectTo) router.push(res.redirectTo);
          router.refresh();
        } else {
          toast.error(res.error);
        }
      } else {
        const res = await createAssignmentAction(valuesWithPublish as CreateAssignmentValues);
        if (res.ok) {
          toast.success(publishOnSave ? "Assignment created & published." : "Draft saved.");
          if (res.redirectTo) router.push(res.redirectTo);
          router.refresh();
        } else {
          toast.error(res.error);
        }
      }
    });
  };

  // Quick-publish action (only valid for existing draft assignments).
  const handleQuickPublish = () => {
    if (!assignment) return;
    startTransition(async () => {
      const res = await publishAssignmentAction({
        assignmentId: assignment.id,
        recipientUserIds: form.getValues("recipientUserIds"),
      });
      if (res.ok) {
        toast.success("Assignment published.");
        setPublishOnSave(true);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Top bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border bg-card p-3">
          <Button asChild variant="ghost" size="sm" className="h-8 w-fit">
            <Link href="/admin/assignments">
              <ArrowLeft className="size-4" />
              Back
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            {isEdit && assignment && assignment.publication_status === "draft" ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9"
                disabled={pending}
                onClick={handleQuickPublish}
              >
                <Send className="size-4" />
                Publish now
              </Button>
            ) : null}
            <Button type="submit" size="sm" className="h-9" disabled={pending}>
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : publishOnSave ? (
                <Send className="size-4" />
              ) : (
                <Save className="size-4" />
              )}
              {publishOnSave ? "Publish" : "Save"}
            </Button>
          </div>
        </div>

        {/* Publish toggle */}
        <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
          <div>
            <p className="text-[13px] font-medium text-foreground">
              Publish on save
            </p>
            <p className="text-[12px] text-muted-foreground">
              Drafts are only visible to leaders. Published assignments appear immediately for selected recipients (or all active members).
            </p>
          </div>
          <Switch checked={publishOnSave} onCheckedChange={setPublishOnSave} aria-label="Publish on save" />
        </div>

        {/* Basics */}
        <Card>
          <CardHeader>
            <CardTitle className="text-[14px]">Basics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[13px]">Title</FormLabel>
                  <FormControl>
                    <Input className="h-9" placeholder="e.g. Build a linear regression model" {...field} />
                  </FormControl>
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
                      placeholder="A short summary shown in lists."
                      {...field}
                    />
                  </FormControl>
                  <FormDescription className="text-[12px]">
                    {field.value?.length ?? 0}/2000
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="assignment_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[13px]">Type</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(v) => field.onChange(v as AssignmentType)}
                    >
                      <FormControl>
                        <SelectTrigger className="h-9 w-full">
                          <SelectValue placeholder="Pick a type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ASSIGNMENT_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {TYPE_LABELS[t]}
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
                name="difficulty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[13px]">Difficulty</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(v) => field.onChange(v as AssignmentDifficulty)}
                    >
                      <FormControl>
                        <SelectTrigger className="h-9 w-full">
                          <SelectValue placeholder="Pick difficulty" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ASSIGNMENT_DIFFICULTIES.map((d) => (
                          <SelectItem key={d} value={d}>
                            {DIFFICULTY_LABELS[d]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="deadline"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[13px]">Deadline</FormLabel>
                    <FormControl>
                      <Input
                        type="datetime-local"
                        className="h-9"
                        value={toDatetimeLocal(field.value ?? "")}
                        onChange={(e) => field.onChange(e.target.value)}
                      />
                    </FormControl>
                    <FormDescription className="text-[12px]">
                      Submissions after this date are flagged late.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="max_score"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[13px]">Max score</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        className="h-9 w-32"
                        placeholder="e.g. 100"
                        value={field.value === null || field.value === undefined ? "" : field.value}
                        onChange={(e) => {
                          const v = e.target.value;
                          field.onChange(v === "" ? null : Number(v));
                        }}
                      />
                    </FormControl>
                    <FormDescription className="text-[12px]">
                      Optional. Reviewers can pick a score within this range.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="required_submission_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[13px]">Required submission type</FormLabel>
                  <Select
                    value={field.value ?? "__any"}
                    onValueChange={(v) =>
                      field.onChange(v === "__any" ? null : (v as SubmissionType))
                    }
                  >
                    <FormControl>
                      <SelectTrigger className="h-9 w-full sm:w-72">
                        <SelectValue placeholder="Any" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__any">Any</SelectItem>
                      {SUBMISSION_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {SUBMISSION_TYPE_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription className="text-[12px]">
                    Constrains the submit form to URL or text input.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Curriculum link */}
        <Card>
          <CardHeader>
            <CardTitle className="text-[14px]">Curriculum link (optional)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="phase_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[13px]">Phase</FormLabel>
                    <Select
                      value={field.value ?? "__none"}
                      onValueChange={(v) => {
                        field.onChange(v === "__none" ? null : v);
                        // Reset week when phase changes.
                        form.setValue("week_id", null);
                      }}
                    >
                      <FormControl>
                        <SelectTrigger className="h-9 w-full">
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none">None</SelectItem>
                        {phases.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.title}
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
                name="week_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[13px]">Week</FormLabel>
                    <Select
                      value={field.value ?? "__none"}
                      onValueChange={(v) => field.onChange(v === "__none" ? null : v)}
                      disabled={!selectedPhase}
                    >
                      <FormControl>
                        <SelectTrigger className="h-9 w-full">
                          <SelectValue placeholder={selectedPhase ? "None" : "Pick a phase first"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none">None</SelectItem>
                        {(selectedPhase?.weeks ?? []).map((w) => (
                          <SelectItem key={w.id} value={w.id}>
                            W{w.week_number}: {w.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-[14px]">Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="instructions"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      rows={8}
                      className="resize-y"
                      placeholder="Step-by-step instructions for the member…"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription className="text-[12px]">
                    {field.value?.length ?? 0}/8000
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Lists: resources / deliverables / criteria */}
        <Card>
          <CardHeader>
            <CardTitle className="text-[14px]">Resources, deliverables & criteria</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <ListEditor
              label="Supporting resources"
              hint="Links to articles, repos, or videos."
              placeholder="https://example.com/guide"
              value={resourceInput}
              onChange={setResourceInput}
              onAdd={addResource}
              items={supportingResources}
              onRemove={removeResource}
              isUrl
            />
            <Separator />
            <ListEditor
              label="Deliverables"
              hint="What the member must produce."
              placeholder="A trained model notebook"
              value={deliverableInput}
              onChange={setDeliverableInput}
              onAdd={addDeliverable}
              items={deliverables}
              onRemove={removeDeliverable}
            />
            <Separator />
            <ListEditor
              label="Evaluation criteria"
              hint="How the submission will be scored."
              placeholder="Model accuracy above 80%"
              value={criteriaInput}
              onChange={setCriteriaInput}
              onAdd={addCriterion}
              items={evaluationCriteria}
              onRemove={removeCriterion}
            />
          </CardContent>
        </Card>

        {/* Recipients */}
        <Card>
          <CardHeader>
            <CardTitle className="text-[14px]">Recipients</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <Label htmlFor="all-members" className="text-[13px]">
                  All active members
                </Label>
                <p className="text-[12px] text-muted-foreground">
                  Leave recipients empty to assign to the whole squad.
                </p>
              </div>
              <Switch
                id="all-members"
                checked={allMembersToggle}
                onCheckedChange={setAllMembersToggle}
                aria-label="All active members"
              />
            </div>

            {!allMembersToggle ? (
              <div className="space-y-2">
                <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
                  Select members
                </p>
                <div className="max-h-72 overflow-y-auto rounded-md border border-border">
                  <ul className="divide-y divide-border">
                    {members.map((m) => {
                      const checked = recipients.includes(m.id);
                      return (
                        <li key={m.id}>
                          <label
                            className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-accent/40"
                            htmlFor={`rec-${m.id}`}
                          >
                            <Checkbox
                              id={`rec-${m.id}`}
                              checked={checked}
                              onCheckedChange={() => toggleRecipient(m.id)}
                            />
                            <span className="flex-1 min-w-0">
                              <span className="block truncate text-[13px] font-medium text-foreground">
                                {m.name}
                              </span>
                              <span className="block truncate text-[12px] text-muted-foreground">
                              </span>
                            </span>
                          </label>
                        </li>
                      );
                    })}
                    {members.length === 0 ? (
                      <li className="px-3 py-3 text-[12px] text-muted-foreground">
                        No active members available.
                      </li>
                    ) : null}
                  </ul>
                </div>
                <p className="text-[12px] text-muted-foreground">
                  <span className="nums font-medium text-foreground">{recipients.length}</span>{" "}
                  selected
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </form>
    </Form>
  );
}

interface ListEditorProps {
  label: string;
  hint: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onAdd: () => void;
  items: string[];
  onRemove: (idx: number) => void;
  isUrl?: boolean;
}

function ListEditor({
  label,
  hint,
  placeholder,
  value,
  onChange,
  onAdd,
  items,
  onRemove,
  isUrl,
}: ListEditorProps) {
  return (
    <div>
      <p className="text-[13px] font-medium text-foreground">{label}</p>
      <p className="text-[12px] text-muted-foreground">{hint}</p>
      <div className="mt-2 flex gap-2">
        <Input
          className="h-9"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onAdd();
            }
          }}
          inputMode={isUrl ? "url" : undefined}
        />
        <Button type="button" variant="outline" size="sm" className="h-9" onClick={onAdd}>
          <Plus className="size-4" />
          Add
        </Button>
      </div>
      {items.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {items.map((item, idx) => (
            <li
              key={idx}
              className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-1.5 text-[13px]"
            >
              <span className="break-all text-foreground">{item}</span>
              <button
                type="button"
                onClick={() => onRemove(idx)}
                className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                aria-label={`Remove ${item}`}
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Convert an ISO string to a value usable in <input type="datetime-local">. */
function toDatetimeLocal(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
