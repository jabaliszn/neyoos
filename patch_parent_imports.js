const fs = require('fs');
let code = fs.readFileSync('src/components/portal/parent-portal-client.tsx', 'utf8');

code = code.replace(
  'UserCheck, ShieldCheck, KeyRound, Trash2, Camera, FolderOpen,',
  'UserCheck, ShieldCheck, KeyRound, Trash2, Camera, FolderOpen, ShoppingBag, Book, CalendarDays, CheckCircle2,'
);

fs.writeFileSync('src/components/portal/parent-portal-client.tsx', code);
