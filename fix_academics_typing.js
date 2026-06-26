const fs = require('fs');
const path = 'src/components/academics/academics-client.tsx';

let code = fs.readFileSync(path, 'utf8');

// Declare initialWeights as an 'any' type to avoid implicitly-any indexing
code = code.replace("const initialWeights = {};", "const initialWeights: any = {};");

fs.writeFileSync(path, code, 'utf8');
console.log("FINAL GENERATOR TYPING FIXED!");
