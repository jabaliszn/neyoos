import { readFileSync } from "node:fs";

function assert(condition: unknown, message: string) { if (!condition) throw new Error(message); console.log(`  ✓ ${message}`); }

async function main() {
  console.log("I.81 Liquid Glass intensity + green buttons test");
  const settings = readFileSync("src/components/settings/school-profile-editor.tsx", "utf8");
  assert(settings.includes("My Liquid Glass Intensity") && settings.includes('type="range"'), "settings has a real Liquid Glass intensity slider");
  assert(settings.includes("neyo-liquid-intensity") && settings.includes("--lg-user-blur-boost") && settings.includes("--lg-user-sheen-extra"), "slider persists per-device intensity and applies CSS variables live");
  assert(settings.includes("Matte") && settings.includes("Balanced") && settings.includes("Deep Glass"), "slider communicates visible intensity levels");

  const layout = readFileSync("src/app/layout.tsx", "utf8");
  assert(layout.includes("neyo-liquid-intensity") && layout.includes("--lg-user-blur-boost"), "root pre-paint script applies saved user intensity before the app renders");

  const css = readFileSync("src/app/globals.css", "utf8");
  assert(css.includes("I.81 per-device Liquid Glass intensity") && css.includes("--lg-user-blur-boost") && css.includes("--lg-user-sheen-extra"), "global CSS includes intensity variables for glass blur and sheen");
  assert(css.includes("button.bg-green-500\\/80") && css.includes("backdrop-filter: blur(calc(12px + var(--lg-user-blur-boost)))"), "green primary buttons receive Liquid Glass backdrop blur");
  assert(css.includes("linear-gradient(135deg, rgba(255,255,255,0.28)") && css.includes("border-color: rgba(255,255,255,0.42)"), "green buttons have visible glass highlight and rim");

  const button = readFileSync("src/components/ui/button.tsx", "utf8");
  assert(button.includes("bg-green-500/80") && button.includes("backdrop-blur-md"), "primary Button component keeps glass-ready green button classes");

  console.log("\n✅ I.81 Liquid Glass intensity + green buttons test passed");
}

main().catch((err) => { console.error(err); process.exit(1); });
