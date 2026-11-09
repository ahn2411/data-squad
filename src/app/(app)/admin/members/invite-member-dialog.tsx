"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { inviteMemberAction } from "@/features/members/actions";
import type { TeamRole } from "@/types/database";

export function InviteMemberDialog({
  inviterRole,
}: {
  inviterRole: "admin" | "leader";
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<TeamRole>("member");
  const [pending, startTransition] = useTransition();

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await inviteMemberAction({ email, role });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Invitation sent to ${email.trim()}.`);
      setEmail("");
      setRole("member");
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-9">
          <UserPlus className="size-4" />
          Invite member
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a member</DialogTitle>
          <DialogDescription>
            Send a secure sign-in link. The invitation expires after seven days.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="invite-email" className="text-[13px] font-medium">
              Email address
            </label>
            <Input
              id="invite-email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="member@example.com"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="invite-role" className="text-[13px] font-medium">
              Initial role
            </label>
            <select
              id="invite-role"
              value={role}
              onChange={(event) => setRole(event.target.value as TeamRole)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="member">Member</option>
              {inviterRole === "admin" ? (
                <option value="leader">Team leader</option>
              ) : null}
            </select>
            <p className="text-[12px] text-muted-foreground">
              Invited accounts still need approval before workspace access.
            </p>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending || !email.trim()}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              Send invitation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
