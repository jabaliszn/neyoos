import fs from "node:fs";
import { filterPortfolioItems, portfolioStatusCounts, type PortfolioStatusFilter } from "../src/components/portfolio/portfolio-client";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

const sampleItems: any[] = [
  {
    id: "1",
    title: "Scratch coding fractions animation",
    category: "CODING",
    description: "Interactive revision project",
    status: "SUBMITTED",
    visibleToParents: false,
    storedFileId: null,
    fileUrl: null,
    fileName: "fractions-scratch.pdf",
    fileSizeBytes: 2_000_000,
    externalLink: "https://example.org/scratch",
    competencyId: null,
    subjectId: null,
    clubId: null,
    awardId: null,
    createdByName: "Achieng Mary Otieno",
    approvedByName: null,
    approvedAt: null,
    createdAt: "2026-06-28T08:00:00.000Z",
  },
  {
    id: "2",
    title: "Nairobi River clean-up reflection",
    category: "COMMUNITY",
    description: "Community service journal",
    status: "APPROVED",
    visibleToParents: true,
    storedFileId: null,
    fileUrl: null,
    fileName: "cleanup-journal.pdf",
    fileSizeBytes: 1_000_000,
    externalLink: null,
    competencyId: null,
    subjectId: null,
    clubId: null,
    awardId: null,
    createdByName: "Wanjiru Kamau",
    approvedByName: "Wanjiru Kamau",
    approvedAt: "2026-06-28T09:00:00.000Z",
    createdAt: "2026-06-28T08:30:00.000Z",
  },
  {
    id: "3",
    title: "Drama festival certificate",
    category: "CERTIFICATE",
    description: "County drama festival certificate",
    status: "REJECTED",
    visibleToParents: false,
    storedFileId: null,
    fileUrl: null,
    fileName: "drama-certificate.pdf",
    fileSizeBytes: 500_000,
    externalLink: null,
    competencyId: null,
    subjectId: null,
    clubId: null,
    awardId: null,
    createdByName: "Chebet Faith",
    approvedByName: null,
    approvedAt: null,
    createdAt: "2026-06-28T07:00:00.000Z",
  },
];

async function main() {
  console.log("Starting J.7 Student Portfolio UX hardening test...");

  const counts = portfolioStatusCounts(sampleItems as any);
  assert(counts.ALL === 3, "status counts calculate ALL correctly");
  assert(counts.SUBMITTED === 1, "status counts calculate SUBMITTED correctly");
  assert(counts.APPROVED === 1, "status counts calculate APPROVED correctly");
  assert(counts.REJECTED === 1, "status counts calculate REJECTED correctly");
  assert(counts.VISIBLE_TO_FAMILY === 1, "status counts calculate family-visible approved items correctly");

  const searchCoding = filterPortfolioItems(sampleItems as any, "scratch", "ALL");
  assert(searchCoding.length === 1 && searchCoding[0].id === "1", "query filter matches title/file text");

  const searchOwner = filterPortfolioItems(sampleItems as any, "kamau", "ALL");
  assert(searchOwner.length === 1 && searchOwner[0].id === "2", "query filter matches owner/approver names");

  const approvedOnly = filterPortfolioItems(sampleItems as any, "", "APPROVED");
  assert(approvedOnly.length === 1 && approvedOnly[0].id === "2", "status filter matches APPROVED items");

  const visibleOnly = filterPortfolioItems(sampleItems as any, "", "VISIBLE_TO_FAMILY" as PortfolioStatusFilter);
  assert(visibleOnly.length === 1 && visibleOnly[0].id === "2", "status filter matches family-visible approved items");

  const none = filterPortfolioItems(sampleItems as any, "biology", "SUBMITTED");
  assert(none.length === 0, "combined query/status filtering returns empty set when nothing matches");

  const source = fs.readFileSync("src/components/portfolio/portfolio-client.tsx", "utf8");
  assert(source.includes("No learner selected yet"), "client shows explicit empty state before learner selection");
  assert(source.includes("No portfolio items match these filters"), "client shows explicit filtered-empty state");
  assert(source.includes("Timeline Filters"), "client includes search/filter toolbar copy");
  assert(source.includes("Show queue") || source.includes("Hide queue"), "client includes approval queue toggle behavior");
  assert(source.includes("Nothing is ready for export yet"), "client guards export when no approved visible items exist");
  assert(!/\bAI\b/.test(source), "Bundi copy law respected in UX client source");

  console.log("J.7 Chunk 7 Student Portfolio UX hardening test passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
