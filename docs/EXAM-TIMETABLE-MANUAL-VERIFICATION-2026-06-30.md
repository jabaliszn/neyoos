# Exam Timetable Manual Verification Checklist — 2026-06-30

Use this short checklist to verify the new Exam Timetable flow in a real browser without needing technical knowledge.

## Goal
Confirm that a school can:
- create an exam paper slot
- edit it
- delete it
- target a single class, stream group, or combination group
- choose eligible invigilators
- generate invigilators
- still generate with an honest warning when no fully free invigilator exists

---

## Before you start
1. Log in as a user who can manage exams.
2. Open **Academics**.
3. Open the **Exam Timetable** tab.
4. Make sure at least one class and one subject already exist.
5. If testing **COMBINATION**, make sure that subject already has a saved **Combination Group** in the Smart Timetable area.

---

## Test 1 — Basic slot creation
**Expected result:** A new exam paper should save and appear on the right.

1. In **Exam name**, enter: `Midterm QA 2026`
2. Choose a **Class**.
3. Choose a **Subject**.
4. Choose **Paper type** = `PP1`
5. Pick a **Date**.
6. Pick **Start** and **End** times.
7. Enter a **Venue**.
8. Leave **Target scope** as `Single class`.
9. Leave **Invigilator pool mode** as `Auto`.
10. Click **Save Exam Slot**.

Check:
- success toast appears
- new slot appears on the right
- slot shows subject, class, date/time, venue, and target scope

---

## Test 2 — Edit slot
**Expected result:** Existing slot loads into the form and updates correctly.

1. On the saved slot, click **Edit**.
2. Change one or more items, for example:
   - Paper type to `Theory`
   - Venue
   - Time
3. Click **Update Exam Slot**.

Check:
- success toast appears
- slot updates on the right
- form returns to normal add mode after save

---

## Test 3 — Delete slot
**Expected result:** Saved slot can be removed safely.

1. On a saved slot, click the **delete** icon.
2. Confirm deletion.

Check:
- success toast appears
- slot disappears from the list

---

## Test 4 — Validation checks
**Expected result:** Wrong setup is blocked with a clear message.

### 4A — Bad time order
1. Create a slot with **Start** later than **End**.
2. Click **Save Exam Slot**.

Check:
- save is blocked
- message says end time must be after start time

### 4B — Eligible only with no teacher selected
1. Set **Invigilator pool mode** to `Only selected eligible invigilators`.
2. Do not tick any teacher.
3. Click **Save Exam Slot**.

Check:
- save is blocked
- message says to pick at least one eligible invigilator or switch back to Auto

---

## Test 5 — Stream group targeting
**Expected result:** One exam paper can target multiple classes under a stream/form grouping.

1. Enter or keep an exam name.
2. Choose a class and subject.
3. Set **Target scope** to `Multiple classes / streams`.
4. Tick one stream/form group.
5. Save the slot.

Check:
- success toast appears
- saved slot shows `STREAM_GROUP`
- saved slot shows the target classes clearly

---

## Test 6 — Combination targeting
**Expected result:** Real saved combination groups can be targeted.

1. Choose a subject that already has a saved **Combination Group**.
2. Set **Target scope** to `Combination group`.
3. Tick one available combination group.
4. Save the slot.

Check:
- success toast appears
- saved slot shows `COMBINATION`
- selected combination classes are reflected in the target summary

If no combination group appears:
- this is not automatically a bug
- first confirm that the selected subject truly has an active saved Combination Group

---

## Test 7 — Eligible invigilator pool save
**Expected result:** School can restrict a slot to selected invigilators only.

1. Create or edit a slot.
2. Set **Invigilator pool mode** to `Only selected eligible invigilators`.
3. Tick 1–3 teachers.
4. Save the slot.
5. On the slot card, confirm the eligible pool count is correct.
6. Change the pool on the slot card itself and click **Save Pool**.

Check:
- success toast appears
- eligible teacher count updates
- selected pool remains after reload

---

## Test 8 — Generate invigilators (normal case)
**Expected result:** System assigns available invigilators without unnecessary warning.

1. Make sure there is at least one saved slot for the same exam name.
2. Click **Generate Invigilators**.

Check:
- success toast appears
- slot shows generated invigilator name
- if a free suitable invigilator exists, there should be no fallback warning

---

## Test 9 — Generate invigilators when no fully free teacher exists
**Expected result:** System still generates, but warns honestly.

This is the key founder rule.

1. Prepare a situation where the selected eligible invigilators are all busy teaching at that time.
2. Keep the pool narrow enough that the system has no fully free teacher.
3. Click **Generate Invigilators**.

Check:
- generation still completes
- at least one invigilator is still assigned
- warning is visible and honest
- wording should communicate that normal teaching may be affected / fallback was used

---

## Test 10 — Auto mode clarity
**Expected result:** Auto mode is understandable and does not mislead users.

1. Switch **Invigilator pool mode** to `Auto`.

Check:
- helper text explains that Auto uses the wider staff pool
- eligible teacher checkboxes are disabled in Auto mode

---

## Pass / Fail guide
Mark the flow as:

### PASS
if all of these are true:
- create works
- edit works
- delete works
- stream targeting works
- combination targeting works where real combination groups exist
- eligible-only mode works
- invigilator generation works
- fallback warning appears honestly when needed

### PARTIAL PASS
if the core exam and invigilator flow works, but one of these still needs refinement:
- combination data setup missing
- UI wording still confusing in one area
- one non-blocking display issue exists

### FAIL
if any core workflow breaks:
- cannot save slot
- cannot edit/delete
- cannot generate invigilators
- wrong/hidden fallback warning
- target scope saves the wrong classes

---

## Honest current repo status before browser proof
Already verified in code/tests:
- UI parse = OK
- Exam invigilator backend test = `5 passed, 0 failed`
- Roles regression = `24 passed, 0 failed`

Still not yet proven until this checklist is run in a real browser:
- full end-to-end click flow
- final visual trust from a school operator point of view
