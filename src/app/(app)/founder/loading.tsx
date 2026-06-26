import { Skeleton } from "@/components/ui/skeleton";

export default function FounderOpsLoading() {
  return (
    <div className="w-full space-y-8">
      <div>
        <Skeleton className="h-4 w-48 rounded-full" />
        <Skeleton className="mt-3 h-8 w-72 rounded-full" />
        <Skeleton className="mt-2 h-4 w-[36rem] max-w-full rounded-full" />
      </div>
      <Skeleton className="h-28 rounded-2xl" />
      <div className="flex gap-2">
        {[0,1,2,3,4].map((i) => <Skeleton key={i} className="h-9 w-28 rounded-full" />)}
      </div>
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        {[0,1,2,3,4,5].map((i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    </div>
  );
}
