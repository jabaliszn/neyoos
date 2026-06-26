# NEYO: Live Classrooms, Bank Reconciliation & Role Isolation Spec

This technical specification details NEYO’s architecture to support **Live Online Classes (WebRTC) for TVs & Mobile**, **Automated Bank Statement Importing**, **Multi-Account Receptionists**, **Strict Staff Role-Scoping**, and our **Pre-Import De-duplication Guard**.

---

## 1. WebRTC Live Virtual Classrooms & TV Accounts (Feature G.36)

To support remote learners at home and hybrid learning inside classrooms equipped with wall-mounted Smart TVs, NEYO implements a hardware-agnostic **WebRTC Live Streaming & TV pairing protocol**.

```
    [ Teacher Laptop ] ➔ Starts Live WebRTC P2P stream ➔ Sends frames to Media Server
                                                                   │
                         ┌─────────────────────────────────────────┴─────────────────────────────────────────┐
                         ▼                                                                                   ▼
             [ Student Mobile / Home TV ]                                                        [ Classroom Wall-Mounted Smart TV ]
             - Taps push notification                                                            - Paired via 6-digit code
             - Receives WebRTC frames                                                            - Auto-renders stream fullscreen
```

### 1.1 Classroom TV Accounts Pairing (YouTube-on-TV Style)
*   Smart TVs, Android TVs, and media boxes run the lightweight NEYO TV client app.
*   **The Handshake:** Upon opening, the TV displays a unique, temporary **6-character pairing code** (e.g. `NY-89F`).
*   **The Association:** The school IT technician opens the classroom configuration panel in NEYO on their laptop, inputs `NY-89F`, and associates the TV with a specific room (e.g. *Form 2A Classroom*).
*   NEYO creates a secure, long-lived `DeviceSession` token in the database, binding that physical TV to the classroom's active data stream.

### 1.2 Teacher Live Request & Automated Broadcaster
1.  **The Request:** A teacher navigates to **Academics ➔ Live Classes** and clicks *"Request Online Class"*, setting the subject, target class, and time.
2.  **The Clearance:** Once approved by the HOD or Deputy, NEYO activates the slot.
3.  **Instant Broadcast:** Tapping *"Start Live Class"* triggers an immediate, server-side push notification to all associated students and paired classroom TVs:
    `🎥 Mathematics Live Class is running now! Tap to join stream.`
4.  **Active Lock Banner:** While the class is live, the class dashboard renders a prominent flashing visual: **"🎥 Live Class Running in this Class"**. Paired classroom TVs automatically wake up and stream the teacher's canvas and microphone WebRTC feed fullscreen!

---

## 2. Bank Reconciliation & Automated Statement Importing

NEYO automates 100% of bank deposit auditing, completely eliminating manual ledger balancing at the end of the term.

```
 [ Parent Pays at Bank ] ➔ Presents physical slip to School Receptionist
                                              │
                                              ▼
                              [ Receptionist enters slip Ref ] ➔ Status: PENDING
                                              │
                                              ▼
                              [ Bursar imports Bank statement Excel/CSV ]
                                              │
                                              ▼
                         [ NEYO Automated Reconciliation Parser ]
                                              │
                    ┌─────────────────────────┴─────────────────────────┐
                    ▼                                                   ▼
            [ Slip Ref Matches? ]                             [ Mismatched / Fraud? ]
                    │                                                   │
                    ▼                                                   ▼
         - Mark Slip as PAID                                   Flag for manual audit!
         - Apply to Student Invoice Ledger
         - Send Parent receipt confirmation SMS
```

### 2.1 Parent Slip Recording
When a parent presents a physical deposit slip at the front desk, the receptionist:
1.  Inputs the unique transaction reference number (e.g., KCB Ref: `FT260904BK`).
2.  Inputs the student's admission number (checks both NEYO and legacy ID columns!).
3.  Uploads a scan/photo of the slip. NEYO logs this under `SubscriptionPayment` with status `"PENDING_BANK"`.

### 2.2 Bulk Bank Statement Importing (CSV / Excel)
At the end of the week, the bursar downloads their bank statement Excel/CSV file (from Equity Bank, Co-op, or KCB) and uploads it inside NEYO’s Finance portal:
*   NEYO’s parser reads the CSV row-by-row.
*   It extracts transaction reference codes and matches them against our `"PENDING_BANK"` database rows.
*   **Auto-Reconciliation:** If a match is found, NEYO instantly marks the payment as `"PAID"`, updates the student's invoice ledger balance, and dispatches a confirmation receipt SMS to the parent automatically!

---

## 3. Strict Staff Role-Based Access Scoping (A.3)

To protect sensitive financial and academic records, NEYO enforces absolute, granular role-based access isolation. A staff member is gated strictly to their operational boundary:

| Staff Role | Sidebar Navigation Menu Allowed | Action Permissions | Forbidden Access Gates |
| :--- | :--- | :--- | :--- |
| **Bursar / Cashier** | Finance, Billing, Payments | Capture payments, import bank statements, print receipts | CBC marks, grade books, staff appraisals |
| **Teacher / HOD** | Academics, Exams, CBC, LMS | Enter exam marks, update rubrics, write lesson plans | Financial invoices, SaaS billing, salary ledgers |
| **Bus Driver** | Transport, Vehicles, Fuel logs | Mark bus registers, record fuel fill-ups, log maintenance | Exam results, school profiles, bank deposits |
| **Cafeteria Chef** | Cafeteria, Weekly Menu | Edit weekly meals, approve kitchen boards | Student admission folders, employee contracts |
| **Security Guard** | Security, Gate, Visitors | Log visitors, scan biometric gate badges | Timetable config, fee balances, salary slips |

*All actions run row-scoping checks on the server side—so even if a bus driver tries to manually write to `/api/finance`, the server immediately throws a `403 Forbidden` error!*

---

## 4. Pre-Import De-duplication Guard

To prevent spreadsheet corruptions or duplicate user accounts when bulk importing student or staff directories via Excel/CSV:

```
 [ Bursar uploads Excel file ] ➔ Row-by-Row parsing loop
                                            │
                                            ▼
                    [ Unique Identifier checks on Database ]
                    - Checks: Admission No / Legacy Admission No
                    - Checks: National ID / UPI NEMIS Number
                    - Checks: Primary Email / Phone number
                                            │
                  ┌─────────────────────────┴─────────────────────────┐
                  ▼                                                   ▼
          [ Duplicate Found? ]                              [ Clean Row? ]
                  │                                                   │
                  ▼                                                   ▼
       - HALT TRANSACTION                                  Import row cleanly!
       - Flag row number in RED
       - Alert: "Row 14 duplicate Admission No"
```

### 4.1 How the Guard Operates:
*   Before inserting any record, NEYO checks if there is any student in the database sharing the same `admissionNo`, `legacyAdmissionNo`, `upiNumber`, or `email`.
*   If a duplicate is found, NEYO immediately halts the entire transaction, keeping your database completely pristine and free of corrupt, double-entry rows.

---

## 5. Live Video Meetings & Master Instructor Moderation Controls (G.36 / H.3)

To facilitate direct interactive tutoring and parent-teacher virtual assemblies, NEYO integrates a high-performance **Multi-Peer Live Meetings Engine** with deep moderation features.

```
 [ Instructor Panel ] ➔ (Triggers "Mute All" or "Block Video") ➔ Signals WebRTC Signaling Server
                                                                           │
                               ┌───────────────────────────────────────────┴───────────────────────────────────────────┐
                               ▼                                                                                       ▼
                    [ Pupil 1 Handset ]                                                                     [ Pupil 2 Handset ]
           - Disables mic track locally                                                            - Shuts down webcam stream
           - Audio input locked                                                                    - Conserves local internet bundles
```

### 5.1 Native Screen-Sharing & Multi-Stream Integration
Teachers can share their digital whiteboard, notes, or slides in one tap:
*   **Media Capture Hook:** Tapping *"Share Screen"* triggers the browser's native `navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })` API.
*   NEYO’s conference canvas overlay layers the teacher’s shared screen alongside their camera feed, streaming both video feeds concurrently to students at home or classroom TVs.

### 5.2 Master Instructor Moderation Panels
NEYO provides the host instructor with absolute administrative control over the digital classroom space:
*   **🔊 Mute All Student Microphones:** Tapping *"Mute All"* dispatches a silent websocket signal to all connected student endpoints. The local browser immediately disables their audio track (`mediaStream.getAudioTracks()[0].enabled = false`). Students cannot unmute themselves until they click *"Raise Hand"* and are explicitly unmuted by the teacher.
*   **🎥 Disable All Student Videos:** Tapping *"Block Video"* disables all students' incoming webcam streams (`getVideoTracks()[0].enabled = false`), instantly reclaiming 80% of local internet bandwidth and maintaining perfect classroom discipline.

### 5.3 Zero-Server Client-Side Recordings
To respect absolute user privacy and ensure NEYO's cloud storage databases remain lightweight and free of clunky multi-gigabyte video files:
*   **Zero-Footprint Storage Rule:** No audio/video meeting streams are ever recorded, saved, or buffered on NEYO's central servers or S3/R2 cloud storage buckets.
*   **MediaRecorder API Pipeline:** If a student wants to save a recording of the class for revision, NEYO leverages the HTML5 `MediaRecorder` API directly inside their browser context. The video is processed entirely on the user's phone/computer RAM, compiling and downloading the file directly as a local `.webm` or `.mp4` into their phone's local storage or an attached external drive!

