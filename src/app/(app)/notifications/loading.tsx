import { Skeleton } from "@/components/ui/skeleton";

export default function NotificationsLoading() {
  return (
    <>
      <div className="space-y-2 pb-6">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    </>
  );
}
