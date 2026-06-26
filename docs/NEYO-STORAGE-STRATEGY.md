# NEYO Storage Strategy — BYOS, Google Drive Option, and Safe Scale

Updated: 2026-06-24

## 1. Founder idea summary

The founder proposed a Bring Your Own Storage (BYOS) model inspired by WhatsApp-style storage discipline:

- schools should not force NEYO to carry unlimited storage cost;
- each school can have its own managed storage account;
- files, photos and documents can be encrypted before leaving NEYO;
- user-heavy media such as message attachments and voice notes should avoid growing NEYO storage costs unnecessarily;
- live-class video/calls should not be stored by default;
- users can choose to save recordings/media locally on their own devices;
- when a school storage account nears its limit, NEYO should show a storage bar and offer upgrade options inside NEYO.

This is a good idea, but it must be implemented carefully and legally.

## 2. Important reality check

Google gives personal Google Accounts 15 GB shared across Drive, Gmail and Photos. That does not mean NEYO should create many free personal Gmail accounts at scale for schools.

NEYO should avoid mass-creating consumer Gmail accounts because:

- they are personal-account products, not a clean managed business storage backend;
- recovery can become fragile;
- account deletion/disablement can make files inaccessible;
- automation and billing control are limited;
- using free consumer storage as a business backend can create legal/compliance risk.

The safer Google option is one of these:

1. **School-owned Google Workspace BYOS** — the school connects its own Workspace/Drive account.
2. **NEYO-managed Google Workspace storage** — NEYO creates managed accounts/shared drives under a NEYO-owned Workspace domain if licensing permits.
3. **NEYO storage plan** — NEYO stores encrypted blobs in R2/S3/Backblaze/Wasabi/etc. and charges the school a storage add-on.

## 3. Recommended product design

NEYO should support multiple storage providers through one abstraction:

```txt
StorageProvider
  - NEYO_MANAGED_OBJECT_STORAGE
  - GOOGLE_WORKSPACE_BYOS
  - SCHOOL_GOOGLE_DRIVE_BYOS
```

The school should not need to understand the provider logic. They should see:

```txt
Settings → Storage
```

with:

- storage used;
- storage limit;
- provider status;
- health check;
- upgrade options;
- reconnect button;
- last backup check;
- encryption status.

## 4. Recommended default: NEYO-managed encrypted object storage

For serious scale, NEYO should default to object storage, not consumer Google Drive.

Recommended providers:

- Cloudflare R2;
- AWS S3;
- Backblaze B2;
- Wasabi;
- Google Cloud Storage.

Why this is safer:

- NEYO controls lifecycle rules;
- object versioning can protect against deletion/corruption;
- access can be service-account controlled;
- costs are predictable;
- easier to encrypt before upload;
- easier to migrate later;
- no dependency on school Google account health.

## 5. Google BYOS option

Google BYOS can be offered as an optional school storage path.

### Best Google design

Use a Google Workspace account or Shared Drive, not a personal Gmail account.

Flow:

```txt
School admin opens Settings → Storage
Chooses Google Workspace BYOS
Connects Google through OAuth / Workspace admin flow
NEYO creates a school folder/shared-drive structure
NEYO uploads encrypted file blobs
NEYO stores only file metadata and encrypted keys in NEYO DB
```

### What NEYO stores

NEYO DB stores:

- file ID;
- tenant ID;
- original filename;
- MIME type;
- size;
- checksum;
- provider name;
- provider object ID;
- encrypted data key;
- upload status;
- createdBy;
- createdAt;
- retention policy.

Google stores:

- encrypted blob;
- never plaintext school file if client/server-side encryption is enabled before upload.

## 6. Encryption model

Use envelope encryption.

For every file:

1. Generate a random file data key.
2. Encrypt the file with AES-256-GCM.
3. Encrypt/wrap the file data key with the tenant's key encryption key.
4. Upload only the encrypted blob to storage.
5. Store metadata and wrapped key in NEYO.

Result:

- If someone opens Google Drive directly, they only see encrypted blobs.
- If the Google account is compromised, files are not readable without NEYO keys.
- If someone downloads a blob from Drive, it remains unreadable outside NEYO.

Important: encryption prevents reading and tampering, but cannot alone prevent deletion by a compromised storage admin. Deletion protection requires versioning, retention and backup policy.

## 7. Deletion/corruption protection

To protect against hacked/corrupted accounts:

- enable object versioning where provider supports it;
- keep a NEYO metadata ledger of expected files and checksums;
- run scheduled integrity checks;
- keep a secondary disaster-recovery copy for critical documents;
- use soft-delete / trash windows;
- show provider health in NEYO;
- prevent permanent deletion from normal users;
- log every file deletion request in audit logs.

For Google Drive BYOS, NEYO must detect:

- account disconnected;
- account disabled;
- token expired;
- storage quota exceeded;
- permission removed;
- file missing;
- folder/shared drive deleted;
- upload failures.

## 8. Storage usage bar and upgrade flow

NEYO should show:

```txt
Storage used: 11.8 GB / 15 GB
Status: 79% used
```

Thresholds:

- 70%: info warning;
- 85%: strong warning;
- 95%: block large uploads and prompt upgrade;
- 100%: pause uploads except critical text records.

Upgrade choices:

### Option A — Google BYOS upgrade

If using school Google/Workspace storage:

- NEYO displays instructions or embedded payment request;
- school pays Google/Workspace/Google One depending on account type;
- NEYO rechecks quota after upgrade;
- NEYO resumes uploads.

### Option B — NEYO managed storage add-on

If school prefers NEYO storage:

- NEYO offers storage add-on, e.g. not less than KES 500/month;
- payment goes through NEYO central billing;
- provider switches to NEYO managed storage;
- files remain encrypted.

## 9. WhatsApp-style local storage idea

For messages, voice notes and optional media:

- text messages stay in NEYO database for audit and delivery;
- large attachments can expire or stay local/device-owned depending on policy;
- voice notes can be stored locally on user devices unless school chooses cloud retention;
- live class calls are not recorded by default;
- if teacher records a class, the recording should be an explicit action and consume storage.

Recommended categories:

| Data type | Default storage |
|---|---|
| Student records | NEYO database |
| Receipts/reports/official documents | Cloud encrypted storage |
| Incident proof photos | Cloud encrypted storage |
| Chat text | NEYO database |
| Chat attachments | Configurable: cloud or device/local retention |
| Voice notes | Device-first or short retention unless school saves |
| Live class video | Not stored by default |
| Live class recording | Optional, explicit, storage-billed |

## 10. Legal and compliance considerations in Kenya

NEYO should align with Kenya Data Protection Act principles:

- purpose limitation;
- data minimization;
- access control;
- security safeguards;
- retention rules;
- data subject rights;
- auditability;
- clear processor/controller responsibility.

Schools must understand:

- who owns the data;
- where files are stored;
- what happens if they disconnect storage;
- how long files are retained;
- how to export data;
- what NEYO can and cannot recover.

If BYOS is used, the school should accept terms explaining that losing access to their connected storage provider can affect file availability, though NEYO should use encryption, metadata and health checks to reduce risk.

## 11. Best final architecture

Recommended phased architecture:

### Phase 1 — NEYO storage abstraction

Build models:

- `TenantStorageProvider`
- `StoredFile` provider fields
- `StorageUsageSnapshot`
- `StoragePlan`
- `StorageHealthCheck`

Build UI:

```txt
Settings → Storage
```

Build service interface:

```txt
putObject()
getObject()
deleteObject()
quota()
healthCheck()
```

### Phase 2 — NEYO managed encrypted storage

Use R2/S3-compatible provider first.

### Phase 3 — Google BYOS connector

Add OAuth/Workspace connection, quota check and encrypted uploads.

### Phase 4 — upgrade billing

Add storage add-on billing through NEYO central billing.

### Phase 5 — device-first media retention

Add configurable attachment/voice-note retention rules.

## 12. Founder decision

The best version is not “free Google for everything.”

The best version is:

> NEYO storage abstraction + encrypted files + optional Google BYOS + NEYO managed storage add-on + storage health checks + legal consent.

This gives schools choice, keeps NEYO costs under control, and protects the company from relying on fragile personal Google accounts.

## 13. Founder correction — desired Google-account provisioning model

Founder clarified that the desired model is not “free only forever.” The desired model is:

1. NEYO provisions a fresh storage account for each school.
2. The school starts with the included Google storage quota where allowed.
3. When storage fills up, the school upgrades and pays from inside NEYO.
4. NEYO manages the storage experience so the school does not deal with confusing provider logic.

This can be designed, but the compliant implementation should use **managed Google Workspace accounts or Shared Drives**, not automated mass creation of consumer `@gmail.com` accounts.

### Recommended compliant version

Use a NEYO-controlled Google Workspace domain or a school-owned Workspace domain.

Example account formats:

```txt
karibu-high.storage@storage.neyo.co.ke
uhuru-academy.storage@storage.neyo.co.ke
```

or, if the school owns Workspace:

```txt
storage@karibuhigh.ac.ke
neyo-files@karibuhigh.ac.ke
```

NEYO can provision managed Workspace users with the Google Admin SDK when NEYO owns/administers the Workspace domain and has the right licenses/permissions.

### Password handling rule

NEYO should not store plain Google passwords.

Safer options:

- generate the managed Workspace account;
- force password reset on first human access if humans ever need access;
- preferably use service-account/domain-wide delegation for file operations;
- store only encrypted OAuth refresh tokens or service credentials in NEYO’s encrypted company vault;
- keep the school’s storage access inside NEYO so school users do not need the Google password.

If a recovery credential must exist, store it in a sealed secret vault, encrypted, rotated, and only accessible to a very small SUPER_ADMIN break-glass workflow.

### Upgrade handling

When storage approaches limits, NEYO should show:

```txt
Storage used: 13.8 GB / 15 GB
Action required: Upgrade storage
```

Upgrade paths:

1. **Google Workspace upgrade** — NEYO or the school upgrades the managed Workspace storage/license.
2. **NEYO consolidated billing** — school pays NEYO, and NEYO manages the provider upgrade.
3. **Switch to NEYO managed object storage** — if Google is unsuitable or too expensive.

The UI should not say “KES 0 central cost” as a permanent promise. Better wording:

```txt
Starter storage included where available. Upgrade inside NEYO when your vault is nearly full.
```

### Why this is safer than consumer Gmail automation

Automated consumer Gmail account creation can be fragile and may violate provider policies or create recovery/compliance problems. Managed Workspace accounts are designed for organizational administration, auditability, suspension/recovery and storage controls.

### Final approved direction

NEYO should build:

```txt
NEYO Storage Vault
  → Managed Google Workspace provisioning option
  → School-owned Google Workspace BYOS option
  → NEYO encrypted object-storage option
  → storage usage bar
  → upgrade/payment flow
  → health checks
  → AES-256-GCM encrypted files
  → no plaintext Google passwords in normal app storage
```

This keeps the founder’s desired experience while protecting NEYO legally and technically.

## 14. Storage Vault Batch 2 — encrypted upload adapter built

The first encrypted upload adapter is now in place.

Implemented pieces:

- `encryptBufferForTenant()` encrypts binary files with AES-256-GCM using the tenant DEK.
- `decryptBufferForTenant()` decrypts encrypted file blobs when NEYO serves them back.
- `uploadEncryptedFile()` uploads encrypted blobs to the active storage provider.
- `/api/files/encrypted` accepts multipart uploads and stores encrypted files.
- Processed image uploads now pass through the encrypted upload path.
- `readObject()` checks `StoredFile.encrypted` and decrypts before serving.
- `StoredFile` records encryption metadata: `encrypted`, `encryptionMode`, `checksumSha256`, `wrappedKeyRef`, `provider`, and `providerObjectId`.

This means plaintext files no longer need to leave NEYO for server-side uploads. External providers receive encrypted JSON envelope blobs, while NEYO serves decrypted bytes only through authenticated app routes.

Next storage work:

1. migrate all direct-browser presigned upload flows to encrypted server upload or client-side encryption;
2. add Google Workspace Admin SDK provisioning once credentials/legal consent are ready;
3. add storage upgrade billing through central NEYO billing;
4. add scheduled storage health checks and quota alerts.


## 15. Storage Vault Batch 3 — direct upload migration built

Reusable upload surfaces now use the encrypted NEYO upload path by default.

Changed behavior:

- `FileUpload` no longer presigns and PUTs directly to storage.
- `FileUpload` posts multipart data to `/api/files/encrypted`.
- NEYO receives the plaintext, encrypts it with the tenant key, and only then writes to the provider.
- Existing screens that use `FileUpload` inherit the safer path automatically.
- The legacy presign routes remain in code for backwards compatibility / future client-side encryption, but the standard UI path is now encrypted-first.

This closes the main gap from Batch 2: direct browser upload no longer bypasses NEYO encryption for normal app upload controls.

## 16. Storage Vault Batch 4 — legacy direct upload routes locked

The legacy direct-browser upload routes are now locked by default:

- `/api/files/presign`
- `/api/files/confirm`
- `/api/files/dev-put`

They return `410 Gone` and point callers to `/api/files/encrypted`.

Why:

- direct browser upload can place plaintext files in a provider before NEYO encrypts them;
- standard app uploads now go through `FileUpload` → `/api/files/encrypted`;
- the old routes should not accidentally be used by future screens.

The code keeps an explicit migration-only environment marker:

```txt
NEYO_ALLOW_LEGACY_DIRECT_UPLOADS=true
```

but even then normal users are blocked and the route remains documented as legacy. If NEYO later needs direct upload for very large files, it should be rebuilt with client-side encryption before upload.
