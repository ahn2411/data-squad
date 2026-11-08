import { Skeleton } from "@/components/ui/skeleton";

export default function WeeklyReportDetailLoading() {
  return (
    <>
      <div className="flex flex-col gap-3 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-7 w-32 rounded-md" />
      </div>
      <Skeleton className="mb-4 h-4 w-40" />
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Skeleton className="h-[640px] w-full rounded-xl" />
        <Skeleton className="h-[320px] w-full rounded-xl" />
      </div>
    </>
  );
}
