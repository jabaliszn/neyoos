const fs = require('fs');
let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');

const newFields = `  shortBreak2Start   Int?    // Optional 2nd short break (e.g. afternoon)
  shortBreak2Mins    Int?
  gamesPeriodTarget  String? // JSON array of class IDs targeted for specific PE/Games
  saturdayEarlyHome  Boolean @default(true) // Automatically schedule "HOME" blocks for free periods
`;

if (!schema.includes('shortBreak2Start')) {
  schema = schema.replace(
    'shortBreakMins     Int     @default(15)',
    `shortBreakMins     Int     @default(15)\n${newFields}`
  );
  fs.writeFileSync('prisma/schema.prisma', schema);
}
