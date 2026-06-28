const fs = require('fs');
let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');
// It seems the first sed command failed or put it in the wrong place.
// Let's rely on Prisma format! Wait, prisma format will fix this if we just run it.
