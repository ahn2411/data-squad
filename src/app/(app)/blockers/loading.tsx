import { Skeleton } from "@/components/ui/skeleton";

export default function BlockersListLoading() {
  return (
    <>
      <div className="space-y-2 pb-6">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="space-y-4">
        <div className="flex gap-2">
          <Skeleton className="h-9 w-full max-w-md" />
          <Skeleton className="h-9 w-32" />
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    </>
  );
}
