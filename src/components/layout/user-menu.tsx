"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { LogOut, User as UserIcon, ChevronUp } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOutAction } from "@/features/auth/actions";
import type { TeamRole } from "@/types/database";
import { initials } from "@/lib/format";

interface UserMenuProps {
  name: string | null;
  email: string;
  role: TeamRole;
}

const roleLabels: Record<TeamRole, string> = {
  admin: "Admin",
  leader: "Team leader",
  member: "Member",
};

export function UserMenu({ name, email, role }: UserMenuProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleSignOut = () => {
    startTransition(async () => {
      const res = await signOutAction();
      if (res.ok && res.redirectTo) router.push(res.redirectTo);
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-auto w-full justify-start gap-2.5 px-2 py-1.5 text-left hover:bg-sidebar-accent/60"
          aria-label="Open user menu"
        >
          <Avatar className="size-7 border border-border">
            <AvatarFallback className="bg-primary/10 text-[11px] font-medium text-primary">
              {initials(name ?? email)}
            </AvatarFallback>
          </Avatar>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[13px] font-medium text-sidebar-foreground">
              {name ?? email}
            </span>
            <span className="truncate text-[11px] text-muted-foreground">
              {roleLabels[role]}
            </span>
          </span>
          <ChevronUp className="size-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="top"
        align="start"
        className="w-56"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate text-[13px] font-medium">
            {name ?? "Member"}
          </span>
          <span className="truncate text-[11px] font-normal text-muted-foreground">
            {email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => router.push("/profile")}
          className="text-[13px]"
        >
          <UserIcon className="size-4" />
          Profile
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={handleSignOut}
          disabled={pending}
          className="text-[13px] text-destructive focus:text-destructive"
        >
          <LogOut className="size-4" />
          {pending ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
