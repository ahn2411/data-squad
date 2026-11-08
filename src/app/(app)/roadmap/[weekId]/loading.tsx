import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";

export default function WeekDetailLoading() {
  return (
    <>
      <div className="space-y-2 pb-6">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Link
        href="/roadmap"
        className="mb-4 inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Back to roadmap
      </Link>

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-64 rounded-xl lg:col-span-2" />
        <Skeleton className="h-64 rounded-xl" />
      </div>

      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    </>
  );
}
