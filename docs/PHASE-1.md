# Phase 1 — Foundation

## Scope
1. Establish a dedicated Cloudflare Worker.
2. Provide a basic service root and health check.
3. Keep all existing company websites and deployments isolated.

## Deployment configuration
- Repository: nagasaribu/nagasaribu-ai-workforce
- Branch: main
- Root directory: /
- Build command: leave blank
- Deploy command: npx wrangler deploy
- Worker name: nagasaribu-ai-workforce

## Verification
Open `/health`. Expected fields:
- `ok: true`
- `service: nagasaribu-ai-workforce`
- `phase: 1`
- `status: foundation`

## Safety
Do not add custom domains, routes, DNS changes, production database access, or paid API credentials in this phase.
