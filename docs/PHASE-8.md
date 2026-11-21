# Phase 8 — Conversational Intelligence V3

## Interaction paths

Every natural message is classified before any task is created:

- `conversation` — greetings, questions, advice, opinions, explanations,
  follow-ups and general discussion.
- `read_only_system_query` — status, health, tasks, agents, approvals, audit and
  provider/Telegram questions.
- `internal_work` — explicit research, analysis, calculation, content creation or
  task execution.
- `external_action` — sending, publishing, payment, commitments and other actions
  requiring approval.

Ambiguous messages default to conversation. Conversation and read-only queries do
not create tasks.

## Shared conversation service

Web and Telegram use the same service:

1. Find or create the administrator's conversation in D1.
2. Persist the user message.
3. Load recent conversation turns from `conversation_messages`.
4. Build a bounded context using `CHAT_CONTEXT_MESSAGES` and `CHAT_CONTEXT_CHARS`.
5. Classify the intent.
6. Answer conversationally, answer a status query from real D1/provider data, or
   create and execute a task.
7. Persist the assistant message with task, agent, provider, model, status and mode.
8. Continue the same conversation after reload and across Web/Telegram.

`client_message_id` and Telegram `update_id` prevent duplicate persistence or task
execution. Web and Telegram share one conversation identity per administrator.

## SARA persona

A dedicated SARA system prompt provides a warm, professional Bahasa Melayu voice,
uses conversation history, avoids repetitive introductions, answers simple questions
directly, and forbids inventing operational data or claiming unverified actions.

## Real read-only status

The status path queries D1 and provider configuration directly:

- D1 connectivity and task counts
- active agents
- pending approvals
- DeepSeek/Muse configuration
- Exa availability
- Telegram connection and last update
- recent audit actions

Status answers are generated from the checked snapshot, never from fabricated data.

## Modes

`human`, `simple` and `deep_thinking` remain persisted in
`user_ai_preferences.response_mode` and shared by Web and Telegram. The prompt for
each mode is applied to both conversational replies and task execution.

## Task execution

Explicit internal work still reuses the existing task state machine,
`executeTask()`, specialist routing, DeepSeek primary/Muse fallback and approval
gates. External actions are created as approval-required tasks and are never
executed automatically.

## Data

No new migration was required for V3. It builds on the additive Phase 7 schema:

- `user_ai_preferences`
- `conversations`
- `conversation_messages`

Existing production records are preserved.
