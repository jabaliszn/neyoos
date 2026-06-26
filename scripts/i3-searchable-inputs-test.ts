/**
 * I.3 — mandatory searchable learner/admission inputs.
 * Static regression: operational student pickers must use StudentSearchSelect,
 * not long <select><option> learner dropdowns.
 */
import { readFileSync } from "node:fs";
import { group, test, expect, summary } from "./_assert";

const files = [
  "src/components/cafeteria/cafeteria-client.tsx",
  "src/components/clinic/clinic-client.tsx",
  "src/components/discipline/discipline-client.tsx",
  "src/components/hostel/hostel-client.tsx",
  "src/components/inventory/inventory-client.tsx",
  "src/components/security/gate-client.tsx",
  "src/components/transport/transport-client.tsx",
];

const forbiddenPhrases = [
  "Pick a student…",
  "Search/pick learner…",
  "{students.map((s) => <option",
  "{eligible.map((s) => <option",
];

group("I.3 searchable learner inputs");

for (const file of files) {
  const source = readFileSync(file, "utf8");
  test(`${file} imports StudentSearchSelect`, () => {
    expect(source.includes("StudentSearchSelect")).toBe(true);
  });
  for (const phrase of forbiddenPhrases) {
    test(`${file} has no learner dropdown phrase: ${phrase}`, () => {
      expect(source.includes(phrase)).toBe(false);
    });
  }
}

test("shared component is explicit about required learner/admission searching", () => {
  const source = readFileSync("src/components/students/student-search-select.tsx", "utf8");
  expect(source.includes("aria-required={required}")).toBe(true);
  expect(source.includes("Type learner name or admission number")).toBe(true);
  expect(source.includes("No learner found")).toBe(true);
});

summary();
