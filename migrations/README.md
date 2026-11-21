# D1 Migration Policy

Cloudflare D1 (`nagasaribu-ai-workforce-db`) is the single primary production database.

## Rules

1. Do not create a second database.
2. Do not integrate Supabase or duplicate authentication/CRM records elsewhere.
3. Do not edit an already-applied migration. Add a new versioned SQL file instead.
4. **Every new production migration requires explicit administrator approval.**
5. Test migrations locally first, then request approval before applying remotely.
6. Keep existing schema and data intact. Prefer additive changes.
7. Document data-impact and rollback/backup considerations with the approval request.

## Current migrations

- `0001_initial_schema.sql`
- `0002_ai_execution.sql`
- `0003_task_state_machine.sql`
- `0004_prospect_research.sql`
- `0005_deepseek_prospect_analysis.sql`
- `0006_provider_router.sql`
- `0007_telegram_command_centre.sql`
- `0008_telegram_response_mode.sql`
- `0009_conversational_workspace.sql`

## Commands

```bash
npm run db:migrate:local
# Production requires explicit administrator approval first:
npm run db:migrate:remote
```

See [`docs/ADR-001-database-strategy.md`](../docs/ADR-001-database-strategy.md).
