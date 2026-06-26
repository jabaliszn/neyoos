# NEYO Integration Keys Guide

Updated: 2026-06-25

## Where credentials go

All company-level integration credentials should be entered in:

```txt
NEYO Ops → Business Operations → Integration Credential Vault
```

Do not paste company credentials into public landing content or school settings.

## YouTube Data API key

Purpose:

- powers live YouTube educational search inside School OS Learning Videos;
- saved videos still work without it.

Where to get it:

1. Go to Google Cloud Console.
2. Create/select a NEYO project.
3. Enable **YouTube Data API v3**.
4. Go to **APIs & Services → Credentials**.
5. Create **API key**.
6. Restrict it to YouTube Data API and your app domains where possible.
7. Paste into NEYO Ops as:

```txt
youtube_api_key
```

How it works:

- NEYO sends safe search requests to YouTube Data API.
- Search uses strict safe mode, embeddable videos, education category, Kenya region, English relevance.
- Videos play inside NEYO with privacy-enhanced embeds.

## Google OAuth

Purpose:

- lets users link/sign in with Google after provider activation.

Where to get values:

1. Google Cloud Console → APIs & Services → Credentials.
2. Create OAuth Client ID.
3. Application type: Web application.
4. Add callback URL:

```txt
https://YOUR-DOMAIN/api/oauth/callback/google
```

Save in NEYO Ops:

```txt
oauth_google_client_id
oauth_google_client_secret
```

## Apple OAuth

Purpose:

- lets users link/sign in with Apple after provider activation.

Where to get values:

1. Apple Developer account.
2. Certificates, Identifiers & Profiles.
3. Create Services ID / Sign in with Apple configuration.
4. Add callback URL:

```txt
https://YOUR-DOMAIN/api/oauth/callback/apple
```

Save in NEYO Ops:

```txt
oauth_apple_client_id
oauth_apple_client_secret
```

Apple client secret is usually a JWT generated from Apple key material. Store only the final secret/token in NEYO Ops.

## Microsoft OAuth

Purpose:

- lets users link/sign in with Microsoft after provider activation.

Where to get values:

1. Microsoft Entra admin center / Azure Portal.
2. App registrations → New registration.
3. Add web redirect URI:

```txt
https://YOUR-DOMAIN/api/oauth/callback/microsoft
```

Save in NEYO Ops:

```txt
oauth_microsoft_client_id
oauth_microsoft_client_secret
```

## Important safety

- OAuth client secrets are private.
- API keys should be restricted where possible.
- Never add these values to the public landing page.
- Never screenshot full secrets.
- Rotate keys if exposed.
- Use production callback domains, not localhost, when going live.

## Current OAuth implementation status

NEYO now has:

- encrypted credential vault;
- provider configuration status;
- signed-in OAuth start URLs;
- disconnect path;
- callback receiver and audit trail.

The final provider profile/token exchange should be completed after real provider apps are configured and tested with live credentials.
