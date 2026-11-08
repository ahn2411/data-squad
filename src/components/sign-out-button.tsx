"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/features/auth/actions";

export function SignOutButton({
  variant = "outline",
  label = "Sign out",
}: {
  variant?: "outline" | "ghost" | "secondary";
  label?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant={variant}
      className="h-9"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await signOutAction();
          if (res.ok && res.redirectTo) {
            router.push(res.redirectTo);
            router.refresh();
          }
        })
      }
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <LogOut className="size-4" />
      )}
      {label}
    </Button>
  );
}
