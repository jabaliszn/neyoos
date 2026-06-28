const fs = require('fs');
let code = fs.readFileSync('src/app/api/academics/timetable/generator/route.ts', 'utf8');

code = code.replace(
  'saveTeacherSubjects, generateWholeSchoolTimetable,',
  'saveTeacherSubjects, generateWholeSchoolTimetable, autoAssignTeachersToClasses,'
);

code = code.replace(
  'const result = await saveTeacherSubjects(user, body.teacherId, body.subjectIds as string[]);',
  'const result = await saveTeacherSubjects(user, body.teacherId, (body.subjectIds as any[]).map(s => typeof s === "string" ? { id: s, isStrong: false } : s));'
);

const autoMatcher = `
    if (body.action === "auto_match_teachers") {
      const result = await autoAssignTeachersToClasses(user);
      return ok({ data: result });
    }
`;

code = code.replace(
  'if (body.action === "save_teacher_subjects") {',
  `${autoMatcher}\n    if (body.action === "save_teacher_subjects") {`
);

fs.writeFileSync('src/app/api/academics/timetable/generator/route.ts', code);
