# NEYO Business Management OS — Analysis & Operating Model

_Last updated: 2026-06-24_

## 1. Principle

NEYO must run NEYO inside NEYO.

NEYO Ops is therefore not a random external admin dashboard. It is the internal company operating system inside the product, available only to `SUPER_ADMIN` users, and it manages company operations, customer accounts, launch controls, legal documents, billing enforcement, contracts, customer communication, pricing, content planning and brand assets.

## 2. Access and safety model

Every NEYO Ops action must be:

- `SUPER_ADMIN` gated;
- backed by the real Prisma database;
- audit logged where it changes company/customer state;
- explicit about scope: one school, all subscribers, or platform-wide;
- reversible where practical;
- honest about external integrations that need real credentials, for example YouTube upload authorization.

## 3. Data scopes

NEYO Ops uses three scopes.

### 3.1 Company-level records

These are not tenant-owned school records. They manage NEYO itself.

- `PlatformSetting`
- `PlatformFlag`
- `NeyoIdea`
- `NeyoYoutubePost`
- `NeyoContract`
- `NeyoCustomerThread`
- `NeyoCustomerMessage`
- Founder build logs, metric snapshots, cadence entries and customer interviews

### 3.2 Cross-tenant operational summaries

NEYO Ops can read summarized school/customer state for company operations:

- tenant accounts;
- subscription status;
- subscription payment totals;
- grace/suspension state;
- linked school on contracts, posts and customer threads.

### 3.3 Tenant-owned school data

School operational data remains tenant-owned and tenant-isolated. NEYO Ops should only cross into tenant records for legitimate support, billing, communication or admin operations, and those actions must stay audit-visible.

## 4. NEYO Ops cockpit coverage

The Business Operations cockpit now covers every I.48 company element.

| Area | Current engine | Status |
|---|---|---|
| Accounts, billing, subscriptions, payments | Founder Ops settings API returns schools, subscriptions and `SubscriptionPayment` totals. UI supports plan/status/grandfathered price override. | Live |
| OS lifecycle planning | `neyo_os_lifecycle` `PlatformSetting` stores School/Farm/Business/Creator OS launch rows with status and target launch. | Live |
| NEYO staff, founder page and ideas | `NeyoIdea` model plus Founder Ops build logs, cadence, interviews and staff visibility. | Live |
| Company documents | Privacy Policy and Terms are editable via `PlatformSetting` and update `/privacy` and `/terms`. | Live |
| Maintenance / shutdown | `maintenance_mode`, `maintenance_message` and `maintenance_eta` settings control the platform maintenance lock and founder restore action. | Live |
| Subscriber communications | Segmented in-app/SMS broadcasts to schools from NEYO Ops. | Live |
| Pricing | Dynamic `neyo_pricing_catalog` controls plan prices, limits, package contents and add-ons; grandfathering respected. | Live |
| YouTube / posting | `NeyoYoutubePost` posting calendar with title, caption, channel, audience, status, schedule and linked school. | Live planning/status; real upload waits for YouTube OAuth |
| Contracts and signing | `NeyoContract` with secure public signing token and typed signature capture. | Live |
| Grace enforcement | Subscription state machine sends grace notices/warnings, suspends after grace and never deletes data. | Live |
| Customer ↔ NEYO communication | `NeyoCustomerThread` and `NeyoCustomerMessage` power a school-to-NEYO support inbox. | Live |
| Brand assets | PlatformSettings control logo, colors, favicons, PWA icons, wordmarks, Bundi mascot assets and pattern tiles. | Live |

## 5. Future OS lifecycle management / Future OS launches

The current lifecycle board stores the active NEYO OS roadmap as a JSON PlatformSetting under:

```txt
neyo_os_lifecycle
```

The board currently covers:

- School OS
- Business OS
- Farm OS
- Creator OS

Supported launch states:

- `PLANNED`
- `BUILDING`
- `BETA`
- `LIVE`
- `PAUSED`

Each OS row stores:

- key;
- name;
- status;
- target launch date;
- notes.

Future expansion can add owner, waitlist count, landing-card status, billing package mapping and launch checklist, but the live NEYO Ops lifecycle foundation is already in-system and no-code editable.

## 6. Pricing and SMS policy

NEYO pricing is controlled by `neyo_pricing_catalog` and edited from NEYO Ops.

Rules:

- New subscriptions use the current catalog price.
- Existing subscriptions retain `Subscription.grandfatheredPrice`.
- SMS is not part of base packages.
- SMS is sold as an out-of-package top-up/add-on.

## 7. Billing grace and data preservation

The billing state machine follows this policy:

```txt
ACTIVE overdue → GRACE + customer notice
GRACE ending soon → warning notice
GRACE expired → final notice if needed → SUSPENDED
```

Data preservation rule:

> NEYO never deletes school data because of non-payment.

Suspended accounts are locked by the subscription gate and can reconnect after payment or a NEYO subscription override.

## 8. Contracts and customer communication

Contracts:

- NEYO creates a contract record in NEYO Ops.
- NEYO sends/copies a secure public signing link.
- The authorized school signer types name, role and signature.
- The signature is recorded with timestamp and audit logs.

Customer communication:

- School leaders can contact NEYO from Billing.
- NEYO receives the thread in the Customer ↔ NEYO hub.
- NEYO replies from Business Operations.
- Threads track priority, status, source and channel.

## 9. Brand and content operations

Brand assets are company-level settings. NEYO Ops now controls:

- logo URL;
- primary/accent colors;
- favicons;
- PWA and Apple touch icons;
- light/dark wordmarks;
- Bundi mascot assets;
- pattern tile.

YouTube/content posting uses `NeyoYoutubePost`. NEYO Ops tracks copy/status/links now. True auto-upload should only be enabled after real YouTube OAuth authorization for the official channel.

## 10. Company payment credentials

School fee Paybills remain tenant-owned and live in:

```txt
Settings → Payments
```

NEYO company subscription credentials must not be entered into school settings. They belong in a future company-level NEYO Ops credential area with encryption and auditing.

## 11. Current conclusion

I.48 establishes NEYO Ops as a real internal company operating system:

- company cockpit;
- billing and subscriptions;
- OS lifecycle controls;
- staff/ideas/founder rhythm;
- legal documents;
- maintenance/shutdown;
- subscriber communication;
- dynamic pricing;
- YouTube posting management;
- contract signing;
- grace enforcement;
- customer support inbox;
- brand asset management.

This means NEYO can operate, support and evolve the business from inside NEYO itself.
