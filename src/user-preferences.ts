import type { Env } from "./types.ts";
import {
  DEFAULT_RESPONSE_MODE,
  isResponseMode,
  normalizeResponseMode,
  type ResponseMode,
} from "./response-mode.ts";

export async function getUserResponseMode(
  env: Env,
  userId: string,
): Promise<ResponseMode> {
  const preference = await env.DB.prepare(
    "SELECT response_mode FROM user_ai_preferences WHERE user_id = ?",
  )
    .bind(userId)
    .first<{ response_mode: string }>();
  if (preference && isResponseMode(preference.response_mode)) {
    return preference.response_mode;
  }

  const telegram = await env.DB.prepare(
    `SELECT response_mode FROM telegram_accounts
     WHERE user_id = ? AND status = 'active' LIMIT 1`,
  )
    .bind(userId)
    .first<{ response_mode: string }>();
  if (telegram && isResponseMode(telegram.response_mode)) {
    return telegram.response_mode;
  }

  return DEFAULT_RESPONSE_MODE;
}

export async function setUserResponseMode(
  env: Env,
  userId: string,
  mode: ResponseMode,
): Promise<void> {
  const normalized = normalizeResponseMode(mode);
  const timestamp = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO user_ai_preferences (user_id, response_mode, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       response_mode = excluded.response_mode,
       updated_at = excluded.updated_at`,
  )
    .bind(userId, normalized, timestamp)
    .run();
  await env.DB.prepare(
    `UPDATE telegram_accounts SET response_mode = ?, updated_at = ?
     WHERE user_id = ? AND status = 'active'`,
  )
    .bind(normalized, timestamp, userId)
    .run();
}
