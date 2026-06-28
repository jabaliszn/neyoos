const fs = require('fs');
let code = fs.readFileSync('src/components/academics/academics-client.tsx', 'utf8');

if (!code.includes('audienceRole === "ALL"')) {
  code = code.replace(
    'const [type, setType] = React.useState("event");',
    'const [type, setType] = React.useState("event");\n  const [audienceRole, setAudienceRole] = React.useState("ALL");'
  );

  code = code.replace(
    'body: JSON.stringify({ title: title || "New event", date, endDate, type }),',
    'body: JSON.stringify({ title: title || "New event", date, endDate, type, audienceRole: audienceRole === "ALL" ? undefined : audienceRole }),'
  );

  const oldTypeInput = `<div className="space-y-1"><Label>Type</Label><select value={type} onChange={(e) => setType(e.target.value)} className="w-full h-10 rounded-full border border-navy-200 bg-white px-3 text-sm"><option value="event">Event</option><option value="meeting">Meeting</option><option value="holiday">Holiday</option><option value="exam">Exam / Assessment</option></select></div>`;
  
  const newTypeInput = `<div className="space-y-1"><Label>Type</Label><select value={type} onChange={(e) => setType(e.target.value)} className="w-full h-10 rounded-full border border-navy-200 bg-white px-3 text-sm"><option value="event">Event</option><option value="meeting">Meeting</option><option value="holiday">Holiday</option><option value="exam">Exam / Assessment</option></select></div>
          <div className="space-y-1"><Label>Who is this for?</Label><select value={audienceRole} onChange={(e) => setAudienceRole(e.target.value)} className="w-full h-10 rounded-full border border-navy-200 bg-white px-3 text-sm"><option value="ALL">Whole School</option><option value="PARENT">Parents Only</option><option value="TEACHER">Staff Only</option></select></div>`;

  code = code.replace(oldTypeInput, newTypeInput);
  fs.writeFileSync('src/components/academics/academics-client.tsx', code);
}
