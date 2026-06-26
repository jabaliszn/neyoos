/**
 * Auth layout — calm, centered, no app shell. Generous whitespace (Apple).
 * Used by /login and future auth screens (magic link, etc.).
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-warm-100 dark:bg-navy-950">
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="flex w-full justify-center">{children}</div>
      </main>
      <footer className="px-4 pb-6 text-center text-xs text-navy-400 dark:text-navy-600">
        NEYO · Built for Kenyan schools · {new Date().getFullYear()}
      </footer>
    </div>
  );
}
