import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function BlockersLoading() {
  return (
    <>
      <Link
        href="/blockers"
        className="mb-3 inline-flex items-center gap-1 text-[12px] text-muted-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Blockers
      </Link>
      <div className="space-y-2 pb-6">
        <Skeleton className="h-6 w-72" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </>
  );
}
