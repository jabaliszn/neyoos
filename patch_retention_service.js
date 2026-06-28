const fs = require('fs');
let code = fs.readFileSync('src/lib/services/retention.service.ts', 'utf8');

code = code.replace(
  'isApproved: false,',
  'status: "DRAFT",'
);

code = code.replace(
  'isApproved: false,',
  'status: "DRAFT",' // catch any extra
);

fs.writeFileSync('src/lib/services/retention.service.ts', code);
