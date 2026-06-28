const fs = require('fs');
let code = fs.readFileSync('src/components/portal/parent-portal-client.tsx', 'utf8');

const regex = /function\s+([A-Za-z0-9_]+)\s*\(/g;
let match;
while ((match = regex.exec(code)) !== null) {
  console.log(match[1]);
}
