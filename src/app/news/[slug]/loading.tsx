import { Skeleton } from "@/components/ui/skeleton";

export default function NewsLoading() {
  return (
    <main className="min-h-screen bg-warm-50 px-4 py-12 dark:bg-navy-950 sm:px-6">
      <div className="mx-auto max-w-4xl rounded-[2rem] border border-white/70 bg-white/80 p-8 shadow-card backdrop-blur-xl dark:border-white/10 dark:bg-navy-900/55">
        <Skeleton className="h-7 w-40 rounded-full" />
        <Skeleton className="mt-6 h-12 w-3/4 rounded-full" />
        <Skeleton className="mt-4 h-5 w-full rounded-full" />
        <Skeleton className="mt-2 h-5 w-2/3 rounded-full" />
        <Skeleton className="mt-8 h-72 rounded-3xl" />
      </div>
    </main>
  );
}
