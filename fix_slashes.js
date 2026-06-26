const fs = require('fs');
const path = 'src/components/students/students-client.tsx';
let code = fs.readFileSync(path, 'utf8');
code = code.replace(/\\`/g, '`').replace(/\\\$/g, '$');
fs.writeFileSync(path, code, 'utf8');
console.log("FIXED BACKSLASHES SUCCESS!");
