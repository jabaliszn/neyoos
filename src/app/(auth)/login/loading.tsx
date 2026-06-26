import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Route-level skeleton shown while the login page chunk loads (Loading state). */
export default function LoginLoading() {
  return (
    <div className="animate-fade-in">
      <div className="mb-8 flex flex-col items-center">
        <Skeleton className="h-12 w-12 rounded-2xl" />
        <Skeleton className="mt-4 h-5 w-40" />
        <Skeleton className="mt-2 h-4 w-56" />
      </div>
      <Card>
        <CardContent className="space-y-5 p-6">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-12 w-full rounded-2xl" />
          <Skeleton className="h-10 w-full rounded-full" />
        </CardContent>
      </Card>
    </div>
  );
}
