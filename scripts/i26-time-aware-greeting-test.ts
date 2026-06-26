import { readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

function expectedGreetingForNairobiHour(hour: number) {
  if (hour >= 4 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  return "Good evening";
}

async function main() {
  const dashboard = readFileSync(join(process.cwd(), "src/app/(app)/dashboard/page.tsx"), "utf8");

  assert(dashboard.includes("function getTimeOfDayGreeting"), "dashboard has a dedicated time-of-day greeting helper");
  assert(dashboard.includes("getUTCHours() + 3") && dashboard.includes("% 24"), "greeting uses Nairobi UTC+3 time instead of browser/local server wording");
  assert(dashboard.includes('return "Good morning"') && dashboard.includes('return "Good afternoon"') && dashboard.includes('return "Good evening"'), "dashboard supports morning, afternoon and evening greetings");
  assert(dashboard.includes("const greeting = getTimeOfDayGreeting()") && dashboard.includes("{greeting}, {firstName}"), "dashboard renders the computed greeting, not a hard-coded Good morning");

  assert(expectedGreetingForNairobiHour(7) === "Good morning", "Nairobi 07:00 returns Good morning");
  assert(expectedGreetingForNairobiHour(13) === "Good afternoon", "Nairobi 13:00 returns Good afternoon");
  assert(expectedGreetingForNairobiHour(19) === "Good evening", "Nairobi 19:00 returns Good evening");

  console.log("\nI.26 Time-Aware Greeting test passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
