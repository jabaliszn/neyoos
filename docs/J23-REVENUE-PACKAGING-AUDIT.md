# J.23 Revenue & Product Packaging Opportunities — Audit & Plan
*(Audited 2026-06-28)*

## The Goal
The NEYO curriculum engine, skills passports, and pathway analytics offer significant new value beyond basic school management. We need to structure these as "Add-Ons" or tier-gated features within our billing framework (A.5) so NEYO Ops can monetize them.

## Current State Audit
- In A.5, we built `Subscription` and `TenantModule`.
- We currently have plan tiers: `free_karibu`, `pro`, `elite`.
- We also have `limits.service.ts` to manage soft limits, and `plans.ts` to manage max add-ons.

## The Solution
We will formally map the Part J features into NEYO's Billing ecosystem:
1. **Tier Gating**:
   - `Skills Passport` / `Portfolio`: Pro & Elite tier.
   - `Advanced Analytics` (J.16) / `Pathway Guidance` (J.10, J.18): Elite tier only.
2. **Premium Add-ons**:
   - `Custom Report Template Engine` (J.15): Can be a paid add-on (`custom_reports_addon`) for Pro users or included in Elite.
   - `Inter-School Transfer Passport` (J.14): Paid add-on (`transfer_passport_addon`) per student, or global add-on.
3. **Execution**:
   - Update `src/lib/core/plans.ts` to define these limits.
   - Create a service wrapper or UI toggle in the NEYO Ops dashboard to showcase these as actual monetizable units. Since this is primarily a *business configuration* and *UI restriction* chunk, we will adjust the permissions and `academics-client` to check plan limits.

## J.23 Execution Plan
- **Chunk 1**: Update `plans.ts` to define the new features/add-ons.
- **Chunk 2**: Implement Tier Guards in `academics-client.tsx` (disable tabs if the school is on Free tier).
- **Chunk 3**: Backend enforcement (Throw "PAYMENT_REQUIRED" if Free tier attempts to hit Advanced Analytics).
- **Chunk 4**: Update NEYO Ops UI to view/manage these add-ons for a tenant.
