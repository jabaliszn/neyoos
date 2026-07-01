# Part K Repair Plan — 2026-06-29

Founder chose: **Option 1 — Fix Part K fully**

## Honest downgrade already done first
The following K lines were downgraded before repair because they were not fully proven:
- K.10 line 1 → `[~]`
- K.10 line 2 → `[~]`
- K.10 line 3 → `[~]`
- K.16 line 1 → `[~]`
- K.16 line 2 → `[ ]`

(K.6 sync line was already `[ ]` and remains open.)

## Real gap analysis

### K.10 gaps found
Current code has a real `StudentApprovalRequest` model/service/API, but it is **not yet full-stack safe enough**:
- `submitStudentApprovalRequest()` comment admits row-scope/ownership checks are not really enforced yet
- API GET/POST use invalid plural permission strings (`students.view`) instead of the repo-standard singular permission system
- no strong proof yet that parents can safely submit from the portal with exact child scoping
- no explicit department-permission/photo-edit restriction proof yet

### K.16 gaps found
Current repo has:
- `ExamMaterialRecord`
- `KnecExportBatch` schema
- exam-material API

But there is **no proven service/API/UI flow** yet that:
- gathers parent/class-teacher uploaded application docs by student/class
- validates required labels
- combines them into a real KNEC export batch
- outputs a batch artifact URL / bundle
- proves the workflow by test

## Repair intention
### K.10
Build/repair to true full-stack:
- strict row-scope and ownership checks
- proper singular permissions
- real parent-portal submission UI for photo + document upload requests
- approval workflow UI for class-teacher/staff reviewers
- explicit teacher photo-edit restriction through approval path
- test it end-to-end

### K.16
Build/repair to true full-stack:
- real KNEC batch service on top of `KnecExportBatch`
- collect uploaded document requests by class/student
- validate required labels
- create batch manifest/export payload
- admin/staff UI or route proof
- end-to-end test

### K.6 note
K.6 sync into J.4/J.8 is already honestly open and may be better repaired as part of K repair if the same computation engine work is touched.
