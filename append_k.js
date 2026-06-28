const fs = require('fs');

const file = 'docs/FEATURES-CHECKLIST.md';
let content = fs.readFileSync(file, 'utf8');

const newKFeatures = `
## K.9 — Academic Result Printing & Distribution
- [ ] Academics department can bulk print results for all students arranged stream-wise or class-wise.
- [ ] Class teachers can print their specific class marks/exam performance.

## K.10 — Parent Uploads & Approval Workflows
- [ ] Parents can upload student photos and documents (birth certs, certificates, etc.) via the portal.
- [ ] Uploads enter a "Pending Approval" state; Class Teacher or Department must approve before saving to profile.
- [ ] Restrict teachers from editing student photos without explicit department permission.

## K.11 — Parent Portal: Mobile UI & Payments
- [ ] Mobile view UI revamp: Implement small, dense grid/horizontal scroll cards for (Fees, Results, Attendance, Pickup Safety, Homework, Quizzes, Classnotes, Uniform Shop, Library Books). Pressing a card opens full details.
- [ ] M-Pesa STK Push integration for self-prompted fee payment by parents.
- [ ] Multi-child payment routing: Parent can select which child to pay for or split/share payment across children.
- [ ] Full fee structure visibility per child, dynamically showing different fees for children in different classes.
- [ ] Parents can download class notes and watch class videos directly from the portal.

## K.12 — Advanced Student Duty Roster Engine
- [ ] Toggle to enable/disable the Duty Roster system school-wide.
- [ ] Configure Duty Areas (cleaning, etc.) and target specific classes (e.g., Form 1 & 2 only, Boarding vs Day).
- [ ] Gender equality logic: Balance mixed classes, or allow boys-only / girls-only specific duties.
- [ ] Clash prevention: Strict "one duty per student per time" rule (no double booking).
- [ ] Exclusion rules: Automatically exclude student leaders if configured.
- [ ] Medical exclusion rules: Block health-conditioned/allergic students from specific unsafe duties (e.g., dust allergy).

## K.13 — Automated Sibling Discounts
- [ ] System automatically calculates and applies sibling discounts during fee invoice generation if the school has it enabled.

## K.14 — Digital Signatures & Transcripts
- [ ] Principal can upload and save a digital signature and stamp to the system.
- [ ] Automatically stamp and sign transcripts/report cards when results are officially released.

## K.15 — Student Clearance & Arrears (Transfers)
- [ ] System blocks/flags student transfer if there are pending library arrears (or other departmental arrears).
- [ ] Clearance workflow: Student must pay book value or replace book at the library to get cleared for transfer.

## K.16 — KNEC Document Aggregation
- [ ] Parent or Class Teacher can upload required application exam documents (scanned versions).
- [ ] System aggregates and combines uploaded documents into a specific KNEC format for batch export/sending.
`;

content += newKFeatures;
fs.writeFileSync(file, content);
