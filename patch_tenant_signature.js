const fs = require('fs');
let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');

const newFields = `  principalSignatureUrl String? // K.14 Digital Signature
  schoolStampUrl        String? // K.14 Digital Stamp`;

schema = schema.replace(
  '  curriculum           String? // "CBC" | "8-4-4" | "BOTH"',
  `${newFields}\n  curriculum           String? // "CBC" | "8-4-4" | "BOTH"`
);

fs.writeFileSync('prisma/schema.prisma', schema);
