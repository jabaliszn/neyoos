const fs = require('fs');
let code = fs.readFileSync('src/components/portal/parent-portal-client.tsx', 'utf8');

const regex = /const \[tab, setTab\] = React.useState[^;]+;/s;
const match = regex.exec(code);
if (match) console.log(match[0]);
