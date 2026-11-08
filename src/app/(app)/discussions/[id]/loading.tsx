import { Skeleton } from "@/components/ui/skeleton";

export default function ThreadLoading() {
  return (
    <>
      <div className="flex flex-col gap-3 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-72" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-6 w-24 rounded-md" />
      </div>
      <Skeleton className="mb-4 h-4 w-40" />
      <div className="space-y-3">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-48 w-full rounded-xl" />
        ))}
      </div>
      <Skeleton className="mt-3 h-32 w-full rounded-xl" />
    </>
  );
}
