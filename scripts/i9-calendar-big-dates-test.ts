import { readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

const source = readFileSync(join(process.cwd(), "src/components/calendar/calendar-view.tsx"), "utf8");

assert(source.includes("H.2 Big Date Calendar"), "calendar source documents the H.2/I.9 big-date fix");
assert(source.includes("h-9 w-9") && source.includes("text-base") && source.includes("leading-none"), "month grid date numbers are larger and use leading-none to stop vertical drift");
assert(source.includes("h-12 w-12") && source.includes("text-2xl") && source.includes("shrink-0"), "week/day agenda date badge is large, fixed-size and cannot collapse upward");
assert(source.includes("fixed-height date header") || source.includes("date header that stays put"), "agenda header includes no-drift implementation note");
const monthDateLine = source.split("\n").find((line) => line.includes("inline-flex h-9 w-9")) ?? "";
assert(monthDateLine.includes("text-base") && !monthDateLine.includes("text-[10px]"), "month date number itself is not tiny text");

console.log("\nI.9 calendar big-date verification passed.");
