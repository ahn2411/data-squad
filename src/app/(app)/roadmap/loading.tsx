import { Skeleton } from "@/components/ui/skeleton";

export default function RoadmapLoading() {
  return (
    <>
      <div className="flex flex-col gap-3 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
      </div>

      <Skeleton className="mb-6 h-20 w-full rounded-xl" />

      <div className="space-y-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl border border-border bg-card">
            <div className="flex items-start justify-between border-b border-border p-6">
              <div className="space-y-2">
                <Skeleton className="h-4 w-64" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-8 w-32" />
            </div>
            <div className="divide-y divide-border">
              {[0, 1].map((j) => (
                <div key={j} className="flex items-center gap-3 p-5">
                  <Skeleton className="size-8 rounded-md" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-56" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
