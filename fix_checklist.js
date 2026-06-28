const fs = require('fs');
let code = fs.readFileSync('docs/FEATURES-CHECKLIST.md', 'utf8');

code = code.replace('- [ ] Create \\`SubjectPaper\\` model to allow splitting a subject into PP1, PP2, PP3, Theory, or Practical.', '- [x] Create \\`SubjectPaper\\` model to allow splitting a subject into PP1, PP2, PP3, Theory, or Practical.');
code = code.replace('- [ ] Create \\`TermAggregationRule\\` model allowing schools to define how different assessment types form the final term report.', '- [x] Create \\`TermAggregationRule\\` model allowing schools to define how different assessment types form the final term report.');
code = code.replace('- [x] Support a simple "Total - [ ] Support a simple "Total & Average" traditional fallback mode Average" traditional fallback mode for schools that do not want complex ratio weighting.', '- [x] Support a simple "Total & Average" traditional fallback mode for schools that do not want complex ratio weighting.');

fs.writeFileSync('docs/FEATURES-CHECKLIST.md', code);
