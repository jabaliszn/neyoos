# NEYO YouTube Management & Posting Strategy

Updated: 2026-06-24

## Purpose

NEYO uses YouTube in two separate ways:

1. **School OS learning videos** — teachers and students search, save, watch and cast educational YouTube videos inside NEYO.
2. **NEYO Ops posting management** — NEYO plans and tracks official channel posts, school launch videos, tutorials and public updates from the company cockpit.

These must stay connected but not confused.

## What is live now

### School OS learning videos

- Teachers/students use `/learning-videos`.
- Videos play inside NEYO using privacy-enhanced embeds: `youtube-nocookie.com`.
- Teachers can cast a class video to a TV/projector from a phone.
- Students can later see videos shown in class.
- NEYO does not expose a download action.
- True zero-ad YouTube playback cannot be guaranteed by NEYO for third-party embeds; zero-ad requires school-owned video hosting or a YouTube-side entitlement.

### NEYO Ops YouTube management

- NEYO Ops → Business Operations has a **YouTube Management & Posting Hub**.
- SUPER_ADMIN can create and manage posting records:
  - title
  - YouTube link/ID
  - caption/posting copy
  - audience
  - channel
  - status
  - schedule date/time
  - owner
  - optional linked school
  - notes
- Every create/update/delete is stored in the database and audit logged.
- The hub does **not** pretend to upload without channel authorization.

## Posting states

- `DRAFT` — idea/copy being prepared.
- `SCHEDULED` — planned for a date/time.
- `READY` — video, caption and approval are ready.
- `POSTED` — published; YouTube URL/ID can be stored.
- `CANCELLED` — no longer planned.

## Approval discipline

Before marking a post `READY`, NEYO should confirm:

- the video is school-safe and relevant;
- any featured school/person has approval;
- captions are factual and not generic marketing fluff;
- thumbnail and title are clear on mobile;
- no private student data is visible;
- any school-linked video has school permission.

## Future YouTube API activation

When NEYO is ready to authorize a real YouTube channel:

1. Create/verify the official NEYO YouTube channel.
2. Configure Google Cloud OAuth consent and YouTube Data API.
3. Store the OAuth credentials as company-level NEYO Ops secrets, not inside a school settings page.
4. Add an upload/publish worker that only acts on `READY` posts.
5. After YouTube returns a video ID, update the posting record to `POSTED`.

Until that OAuth step is complete, NEYO Ops remains the correct source of truth for planning, approvals, links and posting status.

## Owner notes

- SMS remains separate from pricing packages and does not affect YouTube posting.
- Bundi is not required for this workflow.
- NEYO should keep school learning videos inside the School OS and company posting records inside NEYO Ops.
