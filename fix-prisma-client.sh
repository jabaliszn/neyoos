#!/usr/bin/env bash
set -euo pipefail
rm -rf node_modules/.prisma
./node_modules/.bin/prisma generate
cp node_modules/@prisma/client/scripts/default-index.js node_modules/.prisma/client/default.js
cp node_modules/@prisma/client/scripts/default-index.d.ts node_modules/.prisma/client/default.d.ts
cp node_modules/@prisma/client/scripts/default-index.js node_modules/.prisma/client/index.js
cp node_modules/@prisma/client/scripts/default-index.d.ts node_modules/.prisma/client/index.d.ts
node -e "const c=require('@prisma/client'); console.log('keys',Object.keys(c)); console.log('PrismaClient',typeof c.PrismaClient)"
