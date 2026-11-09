"use client";

import * as React from "react";
import { useTransition } from "react";
import Link from "next/link";
import {
  MoreHorizontal,
  Check,
  Ban,
  RotateCcw,
  UserMinus,
  Shield,
  Loader2,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
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
import { RoleBadge, MembershipBadge } from "@/components/status-pill";
import { initials, formatDate } from "@/lib/format";
import type { MemberWithProfile, TeamRole } from "@/types/database";
import {
  approveMemberAction,
  suspendMemberAction,
  reinstateMemberAction,
  removeMemberAction,
  changeRoleAction,
} from "@/features/members/actions";

interface MembersTableProps {
  members: MemberWithProfile[];
  isAdmin: boolean;
  currentUserId: string;
}

type ConfirmType = "suspend" | "remove";

export function MembersTable({
  members,
  isAdmin,
  currentUserId,
}: MembersTableProps) {
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = React.useState("");
  const [confirm, setConfirm] = React.useState<{
    type: ConfirmType;
    member: MemberWithProfile;
  } | null>(null);

  const pendingCount = members.filter(
    (m) =>
      m.membership_status === "pending_invite" ||
      m.membership_status === "pending_approval",
  ).length;
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const filteredMembers = normalizedSearch
    ? members.filter((member) => {
        const searchable = [
          member.profiles?.full_name,
          member.profiles?.email,
          member.profiles?.username,
          member.profiles?.github_username,
          member.role,
          member.membership_status,
        ];
        return searchable.some((value) =>
          value?.toLocaleLowerCase().includes(normalizedSearch),
        );
      })
    : members;

  const runNonDestructive = (
    fn: () => Promise<{ ok: boolean; error?: string }>,
    success: string,
  ) => {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) toast.success(success);
      else if (!res.ok) toast.error(res.error ?? "Action failed.");
    });
  };

  const handleConfirm = () => {
    if (!confirm) return;
    const { type, member } = confirm;
    startTransition(async () => {
      const res =
        type === "suspend"
          ? await suspendMemberAction({ memberId: member.id })
          : await removeMemberAction({ memberId: member.id });
      if (res.ok) {
        toast.success(type === "suspend" ? "Member suspended." : "Member removed.");
      } else if (!res.ok) {
        toast.error(res.error);
      }
      setConfirm(null);
    });
  };

  if (members.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-10 text-center">
        <p className="text-[14px] font-medium text-foreground">No members yet</p>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Members appear here once they register and you approve them.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <span className="nums font-medium text-foreground">{filteredMembers.length}</span>
        {filteredMembers.length === 1 ? "member" : "members"}
        {normalizedSearch ? <span>of {members.length}</span> : null}
        {pendingCount > 0 ? (
          <>
            <span className="text-muted-foreground/50">·</span>
            <span className="nums font-medium text-warning">{pendingCount}</span>
            pending
          </>
        ) : null}
        </div>
        <div className="relative w-full sm:max-w-xs">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search members…"
            aria-label="Search members by name, username, role, or status"
            className="pl-9"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="min-w-[220px]">Member</TableHead>
              <TableHead className="w-[110px]">Role</TableHead>
              <TableHead className="w-[130px]">Status</TableHead>
              <TableHead className="w-[120px]">Joined</TableHead>
              {isAdmin ? <TableHead className="w-[44px] text-right" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredMembers.map((member) => {
              const isSelf = member.user_id === currentUserId;
              const status = member.membership_status;
              const name = member.profiles?.full_name ?? member.profiles?.username ?? "Member";

              return (
                <TableRow key={member.id} className="group">
                  {/* Member cell — sticky on horizontal scroll */}
                  <TableCell className="min-w-[220px]">
                    <Link href={`/admin/members/${member.user_id}`} aria-label={`View ${name}'s profile and activity`} className="flex items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <Avatar className="size-8 border border-border">
                        <AvatarFallback className="bg-primary/10 text-[11px] font-medium text-primary">
                          {initials(name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-[13px] font-medium text-foreground">
                            {name}
                          </span>
                          {isSelf ? (
                            <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-normal text-muted-foreground">
                              You
                            </Badge>
                          ) : null}
                        </div>
                        {status === "pending_approval" && member.profiles?.email ? (
                          <p className="truncate text-[11px] text-muted-foreground">{member.profiles.email}</p>
                        ) : null}
                      </div>
                    </Link>
                  </TableCell>

                  <TableCell>
                    <RoleBadge role={member.role} />
                  </TableCell>

                  <TableCell>
                    <MembershipBadge status={status} />
                  </TableCell>

                  <TableCell className="nums text-[13px] text-muted-foreground">
                    {formatDate(member.joined_at ?? member.created_at)}
                  </TableCell>

                  {isAdmin ? (
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 opacity-60 group-hover:opacity-100"
                            disabled={isSelf || pending}
                            aria-label={`Actions for ${name}`}
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
                            Manage member
                          </DropdownMenuLabel>
                          <DropdownMenuSeparator />

                          {/* Status actions */}
                          {(status === "pending_invite" ||
                            status === "pending_approval") && (
                            <DropdownMenuItem
                              onSelect={() =>
                                runNonDestructive(
                                  () => approveMemberAction({ memberId: member.id }),
                                  "Member approved.",
                                )
                              }
                            >
                              <Check className="size-4" />
                              Approve
                            </DropdownMenuItem>
                          )}

                          {status === "suspended" && (
                            <DropdownMenuItem
                              onSelect={() =>
                                runNonDestructive(
                                  () => reinstateMemberAction({ memberId: member.id }),
                                  "Member reinstated.",
                                )
                              }
                            >
                              <RotateCcw className="size-4" />
                              Reinstate
                            </DropdownMenuItem>
                          )}

                          {status === "removed" && (
                            <DropdownMenuItem
                              onSelect={() =>
                                runNonDestructive(
                                  () => reinstateMemberAction({ memberId: member.id }),
                                  "Member re-added.",
                                )
                              }
                            >
                              <RotateCcw className="size-4" />
                              Re-add to team
                            </DropdownMenuItem>
                          )}

                          {status === "active" && (
                            <DropdownMenuItem
                              onSelect={() =>
                                setConfirm({ type: "suspend", member })
                              }
                              className="text-destructive focus:text-destructive"
                            >
                              <Ban className="size-4" />
                              Suspend
                            </DropdownMenuItem>
                          )}

                          {(status === "active" || status === "suspended") && (
                            <DropdownMenuItem
                              onSelect={() =>
                                setConfirm({ type: "remove", member })
                              }
                              className="text-destructive focus:text-destructive"
                            >
                              <UserMinus className="size-4" />
                              Remove
                            </DropdownMenuItem>
                          )}

                          {/* Role change */}
                          {status !== "removed" && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuSub>
                                <DropdownMenuSubTrigger>
                                  <Shield className="size-4" />
                                  Change role
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent className="w-40">
                                  {(["admin", "leader", "member"] as TeamRole[]).map(
                                    (r) => (
                                      <DropdownMenuItem
                                        key={r}
                                        disabled={member.role === r}
                                        onSelect={() =>
                                          runNonDestructive(
                                            () =>
                                              changeRoleAction({
                                                memberId: member.id,
                                                role: r,
                                              }),
                                            "Role updated.",
                                          )
                                        }
                                      >
                                        <span className="capitalize">{r}</span>
                                        {member.role === r ? (
                                          <Check className="ml-auto size-3.5 text-muted-foreground" />
                                        ) : null}
                                      </DropdownMenuItem>
                                    ),
                                  )}
                                </DropdownMenuSubContent>
                              </DropdownMenuSub>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  ) : null}
                </TableRow>
              );
            })}
            {filteredMembers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 5 : 4} className="py-10 text-center text-[13px] text-muted-foreground">
                  No members match “{search.trim()}”.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      {/* Destructive confirmation */}
      <AlertDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
      >
        <AlertDialogContent>
          {confirm ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {confirm.type === "suspend" ? "Suspend member" : "Remove member"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {confirm.type === "suspend"
                    ? `${confirm.member.profiles?.full_name ?? confirm.member.profiles?.username ?? "This member"} will lose access immediately. You can reinstate them later.`
                    : `${confirm.member.profiles?.full_name ?? confirm.member.profiles?.username ?? "This member"} will be removed from the team. Their account and submissions are preserved.`}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleConfirm}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {pending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : confirm.type === "suspend" ? (
                    "Suspend"
                  ) : (
                    "Remove"
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
