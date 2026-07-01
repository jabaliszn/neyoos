const fs = require('fs');
const path = require('path');
const gbPath = path.join(process.cwd(), 'node_modules/@prisma/client/generator-build/index.js');
const src = fs.readFileSync(gbPath, 'utf8');
const marker = 'const PrismaClient = getPrismaClient(config)';
const idx = src.indexOf(marker);
if (idx === -1) throw new Error('Could not find Prisma generator marker');
const start = src.lastIndexOf('const code = `', idx);
if (start === -1) throw new Error('Could not find generated code template start');
const pre = src.slice(start, idx);
const post = src.slice(idx);
const needed = [
  '${buildWarnEnvConflicts(edge, runtimeBase, runtimeNameJs)}',
  '${buildDebugInitialization(edge)}'
];
for (const n of needed) {
  if (!pre.includes(n)) throw new Error('Missing expected template piece: ' + n);
}
console.log('Generator template looks normal.');
const cli = path.join(process.cwd(), 'node_modules/.prisma/client');
const indexJs = path.join(cli, 'index.js');
const runtimeSrc = fs.readFileSync(indexJs, 'utf8');
if (!runtimeSrc.includes('getPrismaClient(config)')) throw new Error('Generated runtime missing real Prisma client code');
fs.copyFileSync(indexJs, path.join(cli, 'default.js'));
const dts = path.join(cli, 'index.d.ts');
if (fs.existsSync(dts)) fs.copyFileSync(dts, path.join(cli, 'default.d.ts'));
console.log('default.js restored from generated index.js');
