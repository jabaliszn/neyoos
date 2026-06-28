const fs = require('fs');
let code = fs.readFileSync('src/components/founder/founder-ops-client.tsx', 'utf8');

const oldTabs = `const TABS = ["Overview", "Build log", "Metrics", "Cadence", "Interviews", "Platform Flags", "Business Operations"] as const;`;
const newTabs = `const TABS = ["Overview", "Build log", "Metrics", "Cadence", "Interviews", "Platform Flags", "Business Operations", "Ecosystem Trends"] as const;`;

code = code.replace(oldTabs, newTabs);

if (!code.includes('import { EcosystemTrendsTab }')) {
  code = code.replace(
    'import { createInApp } from "@/lib/services/notification.service";',
    'import { createInApp } from "@/lib/services/notification.service";\nimport { EcosystemTrendsTab } from "./ecosystem-trends-tab";'
  );
}

const oldTabRender = `{tab === "Business Operations" && <BusinessOperationsTab />}`;
const newTabRender = `{tab === "Business Operations" && <BusinessOperationsTab />}\n        {tab === "Ecosystem Trends" && <EcosystemTrendsTab />}`;

code = code.replace(oldTabRender, newTabRender);

fs.writeFileSync('src/components/founder/founder-ops-client.tsx', code);
