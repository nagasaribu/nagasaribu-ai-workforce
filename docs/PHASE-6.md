# Phase 6 — Telegram Command Centre

SARA can be operated from Telegram without weakening the existing dashboard
authentication or D1 database. Telegram is an additional delivery channel, not a
replacement for administrator authentication.

## Endpoint

`POST /telegram/webhook`

Every request must include:

```
X-Telegram-Bot-Api-Secret-Token: <TELEGRAM_WEBHOOK_SECRET>
```

The Worker compares the header against the Cloudflare secret in constant time.
Missing or invalid secrets return `401` and are audited. The bot token and webhook
secret are never returned by any API or dashboard response.

## One-time secure pairing

1. An authenticated administrator opens the dashboard Telegram panel.
2. `POST /api/telegram/pairing-code` creates a 10-character code valid for 10 minutes.
   Only a SHA-256 hash is stored.
3. The administrator sends `/pair CODE` to the bot in a private chat.
4. The code is consumed atomically and the Telegram user ID, chat ID, username and
   first name are bound to that administrator.

No Telegram user is trusted automatically. Unknown users, group chats, disabled
users, non-administrators, expired codes and reused codes are rejected. A valid
code can only be created by an active administrator through the authenticated API.

## Bot API integration

Implemented server-side through Cloudflare secrets:

- `sendMessage`
- `getMe`
- `setWebhook`
- `getWebhookInfo`

`setWebhook` always targets the existing HTTPS Worker origin at
`/telegram/webhook`, sends `allowed_updates: ["message"]` and keeps pending updates.

## Commands

- `/start` — welcome or pairing instructions
- `/help` — command and usage help
- `/status` — operational summary
- `/tasks` — latest eight tasks
- `/agents` — agent status and active task load
- `/prospects` — prospect pipeline summary
- `/report` — full operational report

Natural-language messages create a task through the existing SARA state machine and
execution pipeline. Results and failures are returned to the Telegram chat.

### External actions

Messages that appear to request an external action (sending e-mail or WhatsApp,
publishing, campaigns, payments, purchases, invoices, contracts and similar) create a
pending task and require explicit `/confirm TASK_ID`. Confirmation writes an approved
approval record and task event before the existing execution gate can continue. The
existing tool configuration and approval checks still apply.

Detection is clause-aware and uses word boundaries rather than raw substring matching:

- Customer/marketing analysis language such as `pelanggan`, `sasaran pelanggan`,
  `cari pelanggan`, `pelan pemasaran`, `strategi pemasaran`, `draf mesej` and
  `cadangan kempen` is not treated as an external action.
- Explicit action phrases such as `hantar WhatsApp kepada pelanggan`,
  `hantar e-mel kepada prospek`, `hubungi pelanggan`, `telefon prospek`,
  `terbitkan iklan`, `laksanakan kempen pemasaran`, `buat pembayaran` and
  `beli atau langgan perkhidmatan` remain gated.
- Negated clauses such as `Jangan hantar sebarang mesej` and
  `Jangan hubungi pelanggan` are excluded, while a separate positive external
  instruction in the same message is still gated.
- Analysis/draft-only instructions such as `Sediakan draf sahaja` and
  `Analisis sahaja` do not create an approval gate.

## Duplicate protection and rate limits

- Every Telegram `update_id` is inserted into `telegram_updates` with
  `INSERT OR IGNORE`. A repeated update returns `{ "ok": true, "duplicate": true }`
  without sending another reply.
- Message processing is limited to 30 messages per chat per minute.
- Task creation/execution is limited to 6 operations per administrator per 10 minutes.
- Pairing attempts are limited to 5 per Telegram user per 10 minutes.
- Unpaired users receive at most 3 rejection notices per 10 minutes.
- Invalid webhook secrets are rate-limited and audited.

## Audit logging

Telegram events are written to the existing `audit_logs` table, including:

- `telegram.webhook.rejected`
- `telegram.pairing_code.create`
- `telegram.pairing.success` / `telegram.pairing.failed`
- `telegram.unauthorized`
- `telegram.message`
- `telegram.task.create`
- `telegram.task.confirm`
- `telegram.task.execute`
- `telegram.webhook.register`
- `telegram.unlink`

Plaintext pairing codes, the bot token and the webhook secret are never written to
audit metadata.

## Dashboard

The dashboard shows:

- Telegram configured / ready / linked state
- bot username
- active pairings
- pending pairing codes
- webhook registration state
- last Telegram update and message timestamps
- one-click pairing-code generation, webhook registration and unlinking for administrators

## Database

Migration: `0007_telegram_command_centre.sql`

New tables:

- `telegram_pairing_codes`
- `telegram_accounts`
- `telegram_updates`

The migration is additive. Existing users, roles, sessions, tasks, agents and CRM
data are unchanged.

## Deployment

```bash
npm run typecheck
npm test
npm run db:migrate:remote
npm run deploy
```

Register the webhook from the dashboard or with the optional deployment helper:

```bash
curl -X POST https://nagasaribu-ai-workforce.nagasaribuconsultancy.workers.dev/telegram/register \
  -H "x-telegram-bootstrap-token: <TELEGRAM_BOOTSTRAP_TOKEN>"
```

Remove the bootstrap secret after registration if it is no longer needed.

## Verification status

Automated tests cover invalid webhook secrets, unpaired rejection, successful
administrator pairing, one-time code enforcement, duplicate updates, `/status`,
`/tasks`, natural-language task execution, audit records and explicit confirmation.

### Deployment record — 2026-11-21

- Migration `0007_telegram_command_centre.sql` applied to production D1.
- Worker deployed to `https://nagasaribu-ai-workforce.nagasaribuconsultancy.workers.dev`.
- Webhook registered at `.../telegram/webhook`.
- `getWebhookInfo` returned `matchesExpected: true`, `pendingUpdateCount: 0`.
- Invalid webhook secret returns `401 invalid_webhook_secret`.
- The temporary bootstrap secret was removed and `/telegram/register` now returns `404`.
- Production tables exist and are empty: 0 accounts, 0 pairing codes, 0 updates.

Live Telegram connectivity is **not yet claimed**. No real Telegram message has been
received and answered yet. The next step is for the administrator to generate a pairing
code in the dashboard, send `/pair CODE` to `@Ai_nagasaribu_bot`, and then send
`/status` to complete live verification.
