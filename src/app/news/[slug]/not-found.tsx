import Link from "next/link";
import { Newspaper } from "lucide-react";

export default function NewsNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-warm-50 px-4 dark:bg-navy-950">
      <div className="max-w-md rounded-[2rem] border border-white/70 bg-white/80 p-8 text-center shadow-card backdrop-blur-xl dark:border-white/10 dark:bg-navy-900/55">
        <Newspaper className="mx-auto h-10 w-10 text-green-600" />
        <h1 className="mt-4 text-2xl font-black text-navy-950 dark:text-white">Update not available</h1>
        <p className="mt-2 text-sm leading-6 text-navy-500 dark:text-navy-300">This school update may still be in draft or may have been removed.</p>
        <Link href="/" className="mt-6 inline-flex rounded-full bg-green-600 px-5 py-2.5 text-sm font-bold text-white">Back to school website</Link>
      </div>
    </main>
  );
}
