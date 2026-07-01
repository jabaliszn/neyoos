const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'node_modules/.prisma/client/package.json');
const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
if (pkg.imports && pkg.imports['#main-entry-point']) {
  delete pkg.imports['#main-entry-point'];
  fs.writeFileSync(file, JSON.stringify(pkg, null, 2));
  console.log('Removed #main-entry-point import from generated Prisma package');
} else {
  console.log('No #main-entry-point import found');
}
