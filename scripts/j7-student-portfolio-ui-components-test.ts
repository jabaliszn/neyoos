import fs from "node:fs";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

async function main() {
  console.log("Starting J.7 Student Portfolio System UI components test...");

  const source = fs.readFileSync("src/components/portfolio/portfolio-components.tsx", "utf8");

  const exportsToCheck = [
    "PortfolioHero",
    "PortfolioSummaryGrid",
    "PortfolioLoadingState",
    "PortfolioErrorState",
    "PortfolioEmptyState",
    "PortfolioStorageWarningCard",
    "PortfolioTimelineCard",
    "PortfolioApprovalQueue",
    "PortfolioExportCard",
    "PortfolioItemForm",
  ];
  for (const exportName of exportsToCheck) {
    assert(source.includes(`export function ${exportName}`), `${exportName} is exported`);
  }

  const icons = [
    "FolderOpen",
    "Sparkles",
    "ShieldCheck",
    "CheckCircle2",
    "AlertCircle",
    "Loader2",
    "Plus",
    "Save",
    "Trash2",
    "Pencil",
    "Download",
    "ExternalLink",
    "Eye",
    "EyeOff",
    "Camera",
    "Video",
    "Code2",
    "Medal",
    "ImageIcon",
    "BookMarked",
    "Clock3",
    "CheckSquare",
    "UploadCloud",
    "Archive",
    "Link2",
  ];
  for (const icon of icons) {
    assert(source.includes(icon), `uses Lucide icon ${icon}`);
  }

  assert(source.includes("Storage Vault"), "UI copy mentions encrypted Storage Vault path");
  assert(source.includes("growth beyond marks") || source.includes("creative work"), "UI copy reflects learner growth beyond marks");
  assert(source.includes("Create portfolio item") || source.includes("New portfolio item"), "empty/populated states include clear CTA copy");
  assert(source.includes("Awaiting review"), "approval queue copy is present");
  assert(source.includes("Export pack"), "export CTA copy is present");
  assert(source.includes("50 MB"), "media size limit copy is surfaced in the form");
  assert(source.includes("10 MB") || source.includes("warning threshold"), "storage warning concept is surfaced");

  assert(source.includes("backdrop-blur"), "Liquid Glass styling is present");
  assert(source.includes("rounded-2xl"), "rounded-2xl card styling is present");
  assert(source.includes("shadow-card"), "soft card/button shadows are used");

  assert(!source.includes("fetch("), "components do not fetch directly");
  assert(!source.includes("axios"), "components do not use axios directly");
  assert(!/\bAI\b/.test(source), "Bundi copy law respected: banned word does not appear in UI component source");

  console.log("J.7 Chunk 5 Student Portfolio System UI components test passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
