import fs from "node:fs";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

async function main() {
  console.log("Starting J.8 source module + verification status display test...");

  const componentFile = fs.readFileSync("src/components/learner-journey/learner-journey-components.tsx", "utf8");
  const validationFile = fs.readFileSync("src/lib/validations/learner-journey.ts", "utf8");

  assert(validationFile.includes("sourceModule: z.enum(LEARNER_JOURNEY_SOURCES)"), "timeline entry schema requires a sourceModule");
  assert(validationFile.includes("verificationStatus: z.enum(LEARNER_JOURNEY_VERIFICATION)"), "timeline entry schema requires a verificationStatus enum");
  assert(validationFile.includes('"VERIFIED"') && validationFile.includes('"PENDING"') && validationFile.includes('"NOT_REQUIRED"'), "verification registry covers verified, pending and not-required states");

  assert(componentFile.includes("const meta = SOURCE_META[entry.sourceModule]"), "entry card resolves source metadata from entry.sourceModule");
  assert(componentFile.includes("const SourceIcon = meta.icon"), "entry card displays source-specific icon");
  assert(componentFile.includes("<Badge tone={meta.tone}>{meta.label}</Badge>"), "entry card displays source module label badge");
  assert(componentFile.includes("{formatDate(entry.date)} · {meta.description}"), "entry card displays source module explanation next to the date");

  assert(componentFile.includes("function verificationBadge"), "verification badge helper exists");
  assert(componentFile.includes("const verification = verificationBadge(entry.verificationStatus)"), "entry card resolves verification badge from entry.verificationStatus");
  assert(componentFile.includes("<Badge tone={verification.tone}>{verification.label}</Badge>"), "entry card displays verification status badge");
  assert(componentFile.includes('label: "Verified"') && componentFile.includes('label: "Pending review"') && componentFile.includes('label: "Recorded"'), "entry card has human-readable verification labels");

  const requiredSources = ["EXAM", "ASSESSMENT", "ATTENDANCE", "DISCIPLINE", "COMPETENCY", "SKILLS", "PORTFOLIO", "CERTIFICATE", "SYSTEM"];
  for (const source of requiredSources) {
    assert(componentFile.includes(`${source}: {`), `SOURCE_META covers ${source}`);
  }

  assert(!/\bAI\b/.test(componentFile), "source/verification UI copy follows Bundi copy law");

  console.log("J.8 source module + verification status display test passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
