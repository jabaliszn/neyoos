const fs = require('fs');
let code = fs.readFileSync('src/components/academics/academics-client.tsx', 'utf8');

const oldState = `  const [subjects, setSubjects] = React.useState<Subject[]>([]);
  const [staff, setStaff] = React.useState<any[]>([]);`;
  
const newState = `  const [subjects, setSubjects] = React.useState<Subject[]>([]);
  const [activities, setActivities] = React.useState<any[]>([]);
  const [staff, setStaff] = React.useState<any[]>([]);`;

code = code.replace(oldState, newState);

const oldFetch = `    fetch("/api/academics/subjects").then((r) => r.json()).then((j) => j.ok && setSubjects(j.data.subjects));
    fetch("/api/conversations/recipients").then((r) => r.json()).then((j) => j.ok && setStaff((j.data.recipients ?? []).filter((u: any) => ["TEACHER", "CLASS_TEACHER", "HOD", "DEPUTY_PRINCIPAL"].includes(u.role))));`;

const newFetch = `    fetch("/api/academics/subjects").then((r) => r.json()).then((j) => j.ok && setSubjects(j.data.subjects));
    fetch("/api/timetable/activities").then((r) => r.json()).then((j) => j.ok && setActivities(j.data));
    fetch("/api/conversations/recipients").then((r) => r.json()).then((j) => j.ok && setStaff((j.data.recipients ?? []).filter((u: any) => ["TEACHER", "CLASS_TEACHER", "HOD", "DEPUTY_PRINCIPAL"].includes(u.role))));`;

code = code.replace(oldFetch, newFetch);

fs.writeFileSync('src/components/academics/academics-client.tsx', code);
