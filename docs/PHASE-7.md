# Phase 7 — Conversational Workspace V2

## Web chat-first workspace

After login, the default page is **Sembang SARA**. The page provides:

- A central conversation panel with user and SARA message bubbles.
- A fixed composer with Enter-to-send and Shift+Enter for a new line.
- Loading and execution status indicators.
- Starter actions for customer search, QS analysis, marketing, finance,
  technical support and Creative Studio.
- A persistent response-mode selector.
- Conversation history loaded from D1 across reloads.
- Links from assistant responses to the existing task detail dialog.

The existing task, agent, prospect, approval, user and audit screens remain
available as advanced management sections. Advanced task fields are not shown
on the chat page.

## Shared chat API

Authenticated endpoints:

- `GET /api/chat` — latest web conversation, messages, mode and starter actions.
- `POST /api/chat` — send a message, execute the task pipeline and persist both
  sides of the conversation.
- `GET /api/chat/history` — web conversations and messages for a selected conversation.
- `POST /api/chat/mode` — persist the shared response-mode preference.

The endpoints use the existing session authentication, RBAC, same-origin checks,
audit logs and rate limits.

## Shared execution pipeline

Web chat and Telegram both use `runChatExecution()`, which reuses:

- existing task creation and state machine,
- SARA agent selection and specialist auto-routing,
- `executeTask()`,
- DeepSeek primary / Muse Spark fallback routing,
- approval gates and task/audit events.

Agent selection uses explicit administrator instructions first, then keyword
routing for QS, Marketing, Finance, Technical and Creative Studio, with SARA as
the orchestrator fallback.

`client_message_id` provides web-chat idempotency so duplicate submissions do not
create or execute a second task. Telegram continues to use `update_id` deduplication.

## Response modes

Persisted in `user_ai_preferences.response_mode`:

- `human` — default, natural and concise Bahasa Melayu.
- `simple` — maximum 3–5 simple points.
- `deep_thinking` — structured strategic analysis without revealing hidden
  chain-of-thought.

Telegram aliases `/deep` and `/deep-thinking` are supported. Web and Telegram share
the same preference record. Telegram account rows are synchronized for backward
compatibility.

## Telegram V2

- Modes: `/human`, `/simple`, `/deep_thinking`, `/deep`, `/deep-thinking`, `/mode`.
- `/task <ref>` for full task details using short references.
- `/report` returns a concise summary; `/report full` returns the detailed report.
- Responses use safely escaped Telegram HTML, concise task summaries and one next action.
- Long messages are split without breaking HTML tags.
- The bot command menu is registered with `setMyCommands`.
- Pairing, webhook authentication, update deduplication, approvals and audit logging
  remain intact.

## D1 migration

`0009_conversational_workspace.sql` adds:

- `user_ai_preferences`
- `conversations`
- `conversation_messages`

It is additive and backfills preferences from existing Telegram accounts. The
existing `0008_telegram_response_mode.sql` adds the Telegram mode column.

## Testing

The test suite covers:

- web chat authentication and RBAC,
- message and conversation persistence,
- history after reload,
- shared mode persistence,
- mode-aware task metadata and prompts,
- specialist auto-routing,
- task execution status,
- web and Telegram duplicate prevention,
- approval-required actions and `/confirm`,
- Telegram formatting, `/task`, `/mode` and `/report full`,
- HTML escaping and safe message splitting,
- existing login, CRM, D1 and provider tests.

## Deployment verification — 2026-11-21

- Migrations `0008` and `0009` applied to production D1.
- Existing data preserved: 1 user, 1 Telegram account, 7 tasks before migration;
  preferences backfilled to `human`.
- Worker deployed from commit `7a7f351`; final active version after bootstrap-secret
  removal: `fa71e396-b741-4ae3-abb4-d5edecb20d80`.
- Production web chat verified with a temporary administrator session:
  - authenticated `GET /api/chat` returned human mode, 6 starter actions and the
    requested welcome text;
  - `POST /api/chat/mode` persisted `simple`;
  - `POST /api/chat` with `/human` persisted a conversation and both messages;
  - `GET /api/chat/history` returned the conversation.
- The temporary verification user and conversation were deleted; counts remain
  1 user, 1 preference, 0 conversations, 0 messages and 7 tasks.
- Telegram webhook registration and command-menu registration succeeded
  (`commandsRegistered: true`); the temporary bootstrap secret was removed.
- No new real Telegram message arrived after the deployment. Telegram V2 live
  message/reply verification therefore remains pending the next real message.
- `/health` reports D1, auth, DeepSeek, Muse backup, Exa search and Telegram healthy.
- `npm run typecheck` passed; `npm test` passed **127 tests**.
