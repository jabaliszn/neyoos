import fs from "node:fs";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

async function main() {
  console.log("Starting J.7 Student Portfolio System page wiring test...");

  const pageSource = fs.readFileSync("src/app/(app)/portfolio/page.tsx", "utf8");
  const clientSource = fs.readFileSync("src/components/portfolio/portfolio-client.tsx", "utf8");
  const navSource = fs.readFileSync("src/lib/core/navigation.ts", "utf8");
  const studentProfileSource = fs.readFileSync("src/components/students/student-profile-client.tsx", "utf8");
  const parentPortalSource = fs.readFileSync("src/components/portal/parent-portal-client.tsx", "utf8");

  assert(pageSource.includes("export default async function PortfolioPage"), "portfolio page route exists");
  assert(pageSource.includes("requirePageUser"), "portfolio page requires signed-in user");
  assert(pageSource.includes("effectivePermissionsForUser"), "portfolio page checks effective permissions");
  assert(pageSource.includes("PortfolioClient"), "portfolio page mounts connected PortfolioClient");
  assert(pageSource.includes("searchParams?.studentId"), "portfolio page accepts initial studentId from search params");

  assert(clientSource.includes("fetch(\"/api/students\""), "portfolio client loads accessible learners from real students API");
  assert(clientSource.includes("fetch(`/api/portfolio?studentId="), "portfolio client loads row-scoped timeline from real portfolio API");
  assert(clientSource.includes('fetch("/api/portfolio", {'), "portfolio client posts real portfolio actions");
  assert(clientSource.includes("PortfolioHero"), "portfolio client uses PortfolioHero");
  assert(clientSource.includes("PortfolioSummaryGrid"), "portfolio client uses PortfolioSummaryGrid");
  assert(clientSource.includes("PortfolioStorageWarningCard"), "portfolio client shows storage warning card");
  assert(clientSource.includes("PortfolioApprovalQueue"), "portfolio client shows approval queue");
  assert(clientSource.includes("PortfolioExportCard"), "portfolio client shows export card");
  assert(clientSource.includes("PortfolioItemForm"), "portfolio client mounts real submit/edit form");
  assert(clientSource.includes("window.history.replaceState"), "portfolio client keeps selected learner in the URL");
  assert(clientSource.includes("/api/competencies") && clientSource.includes("/api/academics/subjects"), "portfolio client loads real linked-learning options where available");

  assert(navSource.includes('{ label: "Portfolio", href: "/portfolio", icon: FolderOpen, permission: "academics.view" }'), "staff navigation includes Portfolio link");
  assert(studentProfileSource.includes('href={`/portfolio?studentId=${s.id}`}'), "student profile links to learner portfolio page");
  assert(parentPortalSource.includes('href={`/portfolio?studentId=${data.child.id}`}'), "parent portal child view links to learner portfolio page");

  assert(!/\bAI\b/.test(pageSource + clientSource), "Bundi copy law respected in page/client source");

  console.log("J.7 Chunk 6 Student Portfolio page test passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
