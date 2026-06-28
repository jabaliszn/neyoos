const fs = require('fs');
let code = fs.readFileSync('src/components/academics/academics-client.tsx', 'utf8');

const regex = /{getSubjectAbbreviation\(slot\.subjectName, slot\.subjectCode\)}/;
code = code.replace(regex, '{slot.slotType === "ACTIVITY" ? slot.activityCategoryName : getSubjectAbbreviation(slot.subjectName || "", slot.subjectCode || "")}');

fs.writeFileSync('src/components/academics/academics-client.tsx', code);
