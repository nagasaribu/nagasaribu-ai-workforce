# ADR-001 — Lock Database Strategy

- **Status:** Accepted and locked
- **Date:** 2026-11-21
- **Project:** NAGASARIBU AI WORKFORCE

## Decision

Cloudflare D1 is the **single primary production database** for NAGASARIBU AI WORKFORCE.

Production database:
- Name: `nagasaribu-ai-workforce-db`
- ID: `20071e74-ddcd-4a1e-98ae-3524d9b1d079`
- Region: APAC

Backend services run on Cloudflare Workers:
- Worker: `nagasaribu-ai-workforce`
- URL: `https://nagasaribu-ai-workforce.nagasaribuconsultancy.workers.dev`

## Constraints

1. **Do not integrate Supabase.**
2. **Do not create a second database.**
3. **Do not duplicate authentication or CRM records** outside the existing D1 database.
4. **Keep all existing D1 migrations and production data intact.**
5. Use Cloudflare Workers for backend services.
6. Cloudflare R2 may be considered for future media storage. R2 is not provisioned by this
   decision and must not be used as a second record database.
7. Any future database migration requires **explicit approval from the administrator** before
   it is applied to production.

## Current schema ownership

The existing D1 database owns:
- Users, roles and authentication state
- Agents, tasks, task events and execution history
- Leads, lead sources, prospect searches and prospect candidates
- Approvals and audit logs
- System settings and provider verification state

No second source of truth is permitted for these records.

## Migration policy

- Migrations are versioned SQL files in `migrations/`.
- Applied migrations are immutable. Corrections are made with a new migration.
- New migrations must be reviewed for data impact, rollback/backup considerations and
  security before approval.
- Production migrations are applied only after explicit administrator approval.
- Local migrations and tests must pass before requesting production approval.
- No migration may create a parallel database or duplicate authentication/CRM tables in
  another system.

## Consequences

- All operational data remains in one Cloudflare account and one D1 database.
- Backup, retention and access reviews focus on the existing D1 database.
- Supabase must not be added as an alternative backend without a new architecture decision
  that explicitly supersedes this ADR.
- Future media storage can use R2, but business records remain in D1.
