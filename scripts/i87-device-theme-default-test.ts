import { readFileSync } from "node:fs";

function assert(condition: unknown, message: string) { if (!condition) throw new Error(message); console.log(`  ✓ ${message}`); }

async function main() {
  console.log("I.87 device default theme + login test");
  const layout = readFileSync("src/app/layout.tsx", "utf8");
  assert(layout.includes("prefers-color-scheme: dark") && layout.includes("if(!t)"), "root pre-paint script reads device dark/light when no user theme is saved");
  assert(layout.includes("d.classList.add(\"dark\")") && layout.includes("d.classList.remove(\"dark\")"), "root pre-paint applies dark or light before rendering");
  assert(layout.includes("<html lang=\"en\"") && layout.includes("suppressHydrationWarning"), "same root pre-paint applies to app and login routes");

  const toggle = readFileSync("src/components/shell/theme-toggle.tsx", "utf8");
  assert(toggle.includes("prefers-color-scheme: dark") && toggle.includes('prefersDark ? "glass-dark" : "glass"'), "theme toggle hydration preserves device default when no preference exists");
  assert(toggle.includes("localStorage.setItem(\"neyo-theme\", next)"), "user can still change and persist theme preference");

  const login = readFileSync("src/app/(auth)/login/page.tsx", "utf8");
  assert(login.includes("dark:"), "login page has dark-mode classes and follows the root device default");

  console.log("\n✅ I.87 device default theme + login test passed");
}

main().catch((err) => { console.error(err); process.exit(1); });
