# I.50 — Cross-Cutting OS Support / Multi-OS Readiness

Updated: 2026-06-24

## Purpose

NEYO is becoming a multi-OS company, not only School OS. Cross-cutting platform features must be shared safely across:

- School OS
- Business OS
- Farm OS
- Creator OS

## Shared platform layer

These features are OS-neutral and must keep working for every OS tenant:

- authentication and sessions;
- tenant isolation;
- billing and central reconnect;
- notifications;
- files and documents;
- search;
- calendar/jobs;
- audit logs;
- platform flags;
- NEYO Ops support and customer communication.

## Tenant OS key

Every tenant now carries:

```txt
Tenant.osKey = school | business | farm | creator
```

This lets the same tenancy, billing, auth, notifications and audit systems serve more than School OS while keeping OS-specific product modules separate.

## OS registry

The source of truth for OS labels, routes and status is:

```txt
src/lib/core/operating-systems.ts
```

It defines each OS name, login path, onboarding path and launch status.

## Dedicated OS entry paths

Each OS has its own entry path:

```txt
/os/school/login
/os/business/login
/os/farm/login
/os/creator/login
```

and onboarding path:

```txt
/os/school/onboarding
/os/business/onboarding
/os/farm/onboarding
/os/creator/onboarding
```

Currently School OS onboarding is live. Business/Farm/Creator onboarding sends users to the waitlist until those OSes are launched.

## Rule

New platform services should not assume every tenant is a school. Use `Tenant.osKey` and the OS registry when copy, onboarding, modules or navigation differ by operating system.
