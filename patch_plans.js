const fs = require('fs');
let code = fs.readFileSync('src/lib/core/plans.ts', 'utf8');

const oldAddOns = `export const ADD_ONS: AddOnDef[] = [
  { key: "sms_topup_1000", name: "SMS top-up (1,000)", pricePerTerm: 800, description: "Out-of-package bundle: 1,000 SMS for school messages this term." },
  { key: "extra_storage", name: "Extra storage (10GB)", pricePerTerm: 500, description: "More room for notes, photos and documents." },
  { key: "hostel_module", name: "Hostel module", pricePerTerm: 2500, description: "Dorms, beds, curfew register, boarding fees." },
  { key: "transport_module", name: "Transport module", pricePerTerm: 2500, description: "Routes, fleet compliance, transport fees." },
  { key: "inventory_module", name: "Inventory & cafeteria", pricePerTerm: 2000, description: "Stores, stock, meal cards, uniform catalogue." },
  { key: "priority_support", name: "Priority support", pricePerTerm: 3000, description: "Same-day responses, onboarding help." },
];`;

const newAddOns = `export const ADD_ONS: AddOnDef[] = [
  { key: "sms_topup_1000", name: "SMS top-up (1,000)", pricePerTerm: 800, description: "Out-of-package bundle: 1,000 SMS for school messages this term." },
  { key: "extra_storage", name: "Extra storage (10GB)", pricePerTerm: 500, description: "More room for notes, photos and documents." },
  { key: "hostel_module", name: "Hostel module", pricePerTerm: 2500, description: "Dorms, beds, curfew register, boarding fees." },
  { key: "transport_module", name: "Transport module", pricePerTerm: 2500, description: "Routes, fleet compliance, transport fees." },
  { key: "inventory_module", name: "Inventory & cafeteria", pricePerTerm: 2000, description: "Stores, stock, meal cards, uniform catalogue." },
  { key: "priority_support", name: "Priority support", pricePerTerm: 3000, description: "Same-day responses, onboarding help." },
  
  // PART J.23 Premium Add-ons
  { key: "skills_passport", name: "Skills Passport & Portfolio", pricePerTerm: 3500, description: "Premium tracking of learner talents and digital evidence." },
  { key: "custom_reports", name: "Modular Report Builder", pricePerTerm: 1500, description: "Design infinite custom no-code report card layouts." },
  { key: "advanced_analytics", name: "Advanced School Analytics", pricePerTerm: 5000, description: "Systemic insights, attendance-performance correlations, and intervention alerts." },
  { key: "pathway_guidance", name: "Career Discovery & Pathways", pricePerTerm: 2000, description: "Track student interests and map Senior School pathways." },
];`;

code = code.replace(oldAddOns, newAddOns);

const oldElite = `    includedModules: [...CORE, "library", "lms", "hostel", "transport", "inventory", "cafeteria"],
    maxAddOns: 10,`;

const newElite = `    // Elite implicitly unlocks premium Part J features
    includedModules: [...CORE, "library", "lms", "hostel", "transport", "inventory", "cafeteria", "skills_passport", "custom_reports", "advanced_analytics", "pathway_guidance"],
    maxAddOns: 15,`;

code = code.replace(oldElite, newElite);

fs.writeFileSync('src/lib/core/plans.ts', code);
