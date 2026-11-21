# Phase 5 — Multi-Model AI Router

## Providers
- **Primary:** DeepSeek (`deepseek-chat`) via `DEEPSEEK_API_KEY`.
- **Backup:** Meta Muse Spark 1.3 (`muse-spark-1.3`) via `META_MODEL_API_KEY`.
- **Search:** Exa via `EXA_API_KEY`.

Meta adapter: `src/providers/meta.ts`.
Router: `src/providers/router.ts`.

## Meta Responses API
`POST https://api.meta.ai/v1/responses` with Bearer authentication:

```json
{
  "model": "muse-spark-1.3",
  "input": [
    { "role": "system", "content": [{ "type": "input_text", "text": "..." }] },
    { "role": "user", "content": [{ "type": "input_text", "text": "..." }] }
  ],
  "reasoning": { "effort": "high", "summary": "auto" },
  "include": ["reasoning.encrypted_content"],
  "store": false,
  "stream": false,
  "max_output_tokens": 1400
}
```

The adapter parses only visible `message` / `output_text` content. Reasoning items,
including `encrypted_content`, are never returned, logged or stored. Usage is mapped from
`input_tokens`, `output_tokens` and `total_tokens`. Request IDs are retained.

## Fallback policy
DeepSeek is always attempted first. Muse Spark is attempted at most once only when DeepSeek
returns a transient failure:

- timeout
- network failure
- HTTP 429
- HTTP 5xx

No fallback occurs for authentication, configuration, invalid request or invalid response
errors. Provider errors are surfaced with sanitized messages. The task records the actual
`provider`, `provider_model`, `fallback_used` and `fallback_reason`. A `provider_fallback`
task event and audit entry are written. External tools are not re-run during fallback.

## Cost control
- Default normal task output: 1,400 tokens.
- Task metadata `maxTokens` can override within 64–4096.
- The probe test caps output at 100 tokens.
- Token usage is recorded per task event and aggregated per provider in the dashboard.
- No duplicate calls beyond one primary attempt and one fallback attempt.

## Dashboard
The dashboard shows:
- DeepSeek: Primary status and model
- Muse Spark: Backup configuration status and model
- Exa: Search status
- Active model/provider
- Total tokens per provider
- Fallback event count
- Provider error count
- Task-level provider/fallback details in the task detail dialog

Backup status is labelled **CONFIGURED** until a successful real Muse response is persisted;
after verification it is labelled **LIVE**.

## Testing
`npm test` covers 85 tests, including:
- DeepSeek primary selection.
- DeepSeek timeout/429/5xx fallback to Muse.
- No fallback on DeepSeek 400/401/403/404.
- Muse authentication errors.
- Both providers unavailable.
- Maximum one fallback attempt.
- Meta request shape, reasoning settings, encrypted-content exclusion, usage and request ID.
- Full Worker fallback integration with `provider_fallback` events and audit logs.

## Real Muse test result — LIVE VERIFIED
A controlled real Meta request succeeded:

- Model: `muse-spark-1.3`
- Reasoning effort: `minimal`
- `max_output_tokens`: `1024`
- `store`: `false`
- `include`: `reasoning.encrypted_content`
- Response status: `completed`
- Visible output: `Muse Spark backup verification berjaya.`
- Request ID: `resp_6b01b2234c18094b08b14148`
- Latency: 2,256 ms
- Usage: 57 input tokens, 40 output tokens, 97 total, 23 reasoning tokens

The verification timestamp and model were stored in `system_settings`. `/health` now reports
`backup: "live"`, and the dashboard shows **Muse Spark LIVE** while DeepSeek remains the active
primary. Encrypted reasoning was not returned, logged or stored.

Earlier attempts with `max_output_tokens: 100` and reasoning effort `high` returned
`status=incomplete`, `output=reasoning`, `reason=max_output_tokens`. The controlled test used
minimal reasoning and 1,024 output tokens, which resolved the issue.

Connectivity tests should continue to use minimal reasoning. Normal fallback tasks retain the
provider's configured reasoning setting.

## Deployment
- Migration: `0006_provider_router.sql`
- Worker: existing `nagasaribu-ai-workforce`
- No new repository, no plan upgrade, no customer campaigns or external actions.
