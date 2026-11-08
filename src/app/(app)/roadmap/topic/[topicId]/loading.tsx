import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function TopicDetailLoading() {
  return (
    <>
      <Link
        href="/roadmap"
        className="mb-4 inline-flex items-center gap-1 text-[12px] text-muted-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Roadmap
      </Link>
      <div className="space-y-2 pb-6">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>
      <Skeleton className="h-96 w-full rounded-xl" />
    </>
  );
}
