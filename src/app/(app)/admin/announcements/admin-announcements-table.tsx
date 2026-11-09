"use client";

import * as React from "react";
import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MoreHorizontal,
  Loader2,
  PencilLine,
  Archive,
  Trash2,
  Search,
  Pin,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  AnnouncementStatusBadge,
  PinnedBadge,
} from "@/features/collaboration/badges";
import { formatDate, relativeTime, initials } from "@/lib/format";
import {
  archiveAnnouncementAction,
  deleteAnnouncementAction,
} from "@/features/announcements/actions";
import { AnnouncementForm } from "./announcement-form";
import type { AnnouncementPage, AnnouncementStatusFilter, AnnouncementWithAuthor } from "@/features/announcements/queries";

interface AdminAnnouncementsTableProps {
  announcementPage: AnnouncementPage;
  searchFilter: string;
  statusFilter: AnnouncementStatusFilter;
}

export function AdminAnnouncementsTable({
  announcementPage,
  searchFilter,
  statusFilter,
}: AdminAnnouncementsTableProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = React.useState(searchFilter);
  const [archiveTarget, setArchiveTarget] =
    React.useState<AnnouncementWithAuthor | null>(null);
  const [deleteTarget, setDeleteTarget] =
    React.useState<AnnouncementWithAuthor | null>(null);

  // Edit dialog state — must be a known row.
  const [editTarget, setEditTarget] =
    React.useState<AnnouncementWithAuthor | null>(null);

  const { announcements, totalCount, page, pageSize } = announcementPage;
  const updateQuery = React.useCallback((next: { search?: string; status?: AnnouncementStatusFilter; page?: number }) => {
    const params = new URLSearchParams();
    if (next.search) params.set("q", next.search);
    if (next.status && next.status !== "all") params.set("status", next.status);
    if (next.page && next.page > 1) params.set("page", String(next.page));
    router.replace(params.size ? `/admin/announcements?${params.toString()}` : "/admin/announcements", { scroll: false });
  }, [router]);
  React.useEffect(() => {
    if (search.trim() === searchFilter) return;
    const timer = window.setTimeout(() => updateQuery({ search: search.trim() || undefined, status: statusFilter }), 350);
    return () => window.clearTimeout(timer);
  }, [search, searchFilter, statusFilter, updateQuery]);

  const handleArchive = () => {
    if (!archiveTarget) return;
    startTransition(async () => {
      const res = await archiveAnnouncementAction({
        announcementId: archiveTarget.id,
      });
      if (res.ok) toast.success("Announcement archived.");
      else toast.error(res.error);
      setArchiveTarget(null);
    });
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    startTransition(async () => {
      const res = await deleteAnnouncementAction({
        announcementId: deleteTarget.id,
      });
      if (res.ok) {
        toast.success("Announcement deleted.");
        if (res.redirectTo) {
          // router.refresh handled by revalidatePath; no navigation needed.
        }
      } else {
        toast.error(res.error);
      }
      setDeleteTarget(null);
    });
  };

  return (
    <>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row">
          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search announcements…"
              className="h-9 pl-9"
              aria-label="Search announcements"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => updateQuery({ search: searchFilter || undefined, status: v as AnnouncementStatusFilter })}>
            <SelectTrigger size="sm" className="h-9 w-[140px]" aria-label="Filter by status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="draft">Drafts</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <span className="text-[12px] text-muted-foreground">
          <span className="nums font-medium text-foreground">
            {totalCount}
          </span>{" "}
          {totalCount === 1 ? "announcement" : "announcements"}
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="min-w-[280px]">Title</TableHead>
              <TableHead className="w-[120px]">Status</TableHead>
              <TableHead className="min-w-[160px]">Author</TableHead>
              <TableHead className="w-[120px]">Published</TableHead>
              <TableHead className="w-[44px] text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {announcements.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5} className="py-8 text-center">
                  <p className="text-[13px] text-muted-foreground">
                    {totalCount === 0 && !searchFilter && statusFilter === "all" ? "No announcements yet. Post your first announcement to keep the squad in the loop." : "No announcements match these filters."}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              announcements.map((row) => {
                const name = row.author?.full_name ?? "Member";
                return (
                  <TableRow key={row.id} className="group">
                    <TableCell className="min-w-[280px]">
                      <div className="flex items-center gap-2 text-[13px] font-medium text-foreground">
                        {row.pinned ? (
                          <Pin className="size-3.5 shrink-0 text-primary" />
                        ) : null}
                        <span className="truncate">{row.title}</span>
                      </div>
                      {row.content ? (
                        <p className="mt-0.5 line-clamp-1 text-[12px] text-muted-foreground">
                          {row.content}
                        </p>
                      ) : null}
                      {row.pinned ? (
                        <div className="mt-1">
                          <PinnedBadge />
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <AnnouncementStatusBadge status={row.status} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="size-7 border border-border">
                          <AvatarFallback className="bg-primary/10 text-[10px] font-medium text-primary">
                            {initials(name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate text-[12px] text-muted-foreground">
                          {name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-[13px] text-muted-foreground">
                      {row.published_at ? (
                        <span title={formatDate(row.published_at)}>
                          {relativeTime(row.published_at)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 opacity-60 group-hover:opacity-100"
                            disabled={pending}
                            aria-label={`Actions for ${row.title}`}
                          >
                            {pending ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <MoreHorizontal className="size-4" />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuLabel className="text-[12px] text-muted-foreground">
                            Manage
                          </DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={() => setEditTarget(row)}>
                            <PencilLine className="size-4" />
                            Edit
                          </DropdownMenuItem>
                          {row.status !== "archived" ? (
                            <DropdownMenuItem
                              onSelect={() => setArchiveTarget(row)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Archive className="size-4" />
                              Archive
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuItem
                            onSelect={() => setDeleteTarget(row)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="size-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-[12px] text-muted-foreground">
        <span>Page {page} of {Math.max(1, Math.ceil(totalCount / pageSize))}</span>
        <span className="flex gap-2">
          {page > 1 ? (
            <Button asChild size="sm" variant="outline"><Link href={adminAnnouncementsHref(searchFilter, statusFilter, page - 1)}><ChevronLeft className="size-4" />Previous</Link></Button>
          ) : <Button size="sm" variant="outline" disabled><ChevronLeft className="size-4" />Previous</Button>}
          {page * pageSize < totalCount ? (
            <Button asChild size="sm" variant="outline"><Link href={adminAnnouncementsHref(searchFilter, statusFilter, page + 1)}>Next<ChevronRight className="size-4" /></Link></Button>
          ) : <Button size="sm" variant="outline" disabled>Next<ChevronRight className="size-4" /></Button>}
        </span>
      </div>

      {/* Edit dialog */}
      {editTarget ? (
        <AnnouncementForm
          mode="edit"
          announcementId={editTarget.id}
          defaults={{
            title: editTarget.title,
            content: editTarget.content ?? "",
            pinned: editTarget.pinned,
            status: editTarget.status,
          }}
          open={editTarget !== null}
          onOpenChange={(v) => !v && setEditTarget(null)}
        />
      ) : null}

      {/* Archive confirm */}
      <AlertDialog
        open={archiveTarget !== null}
        onOpenChange={(open) => !open && setArchiveTarget(null)}
      >
        <AlertDialogContent>
          {archiveTarget ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Archive announcement?</AlertDialogTitle>
                <AlertDialogDescription>
                  &quot;{archiveTarget.title}&quot; will be hidden from members.
                  You can restore it by editing and changing the status back.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleArchive}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {pending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "Archive"
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : null}
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirm */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          {deleteTarget ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete announcement?</AlertDialogTitle>
                <AlertDialogDescription>
                  &quot;{deleteTarget.title}&quot; will be permanently deleted.
                  Notifications already sent to members remain in their inbox.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {pending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "Delete"
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : null}
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function adminAnnouncementsHref(search: string, status: AnnouncementStatusFilter, page: number) {
  const params = new URLSearchParams();
  if (search) params.set("q", search);
  if (status !== "all") params.set("status", status);
  if (page > 1) params.set("page", String(page));
  return `/admin/announcements${params.size ? `?${params.toString()}` : ""}`;
}
