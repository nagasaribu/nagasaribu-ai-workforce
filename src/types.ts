export interface D1Meta {
  changes?: number;
  last_row_id?: number;
}

export interface D1Result<T> {
  results: T[];
  success: boolean;
  meta: D1Meta;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  all<T = unknown>(): Promise<D1Result<T>>;
  run(): Promise<D1Result<unknown>>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  exec(query: string): Promise<unknown>;
}

import type { AiBindings } from "./providers/deepseek.ts";
import type { MetaBindings } from "./providers/meta.ts";
import type { SearchBindings } from "./providers/exa.ts";

export interface TelegramBindings {
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  TELEGRAM_API_BASE?: string;
  TELEGRAM_BOOTSTRAP_TOKEN?: string;
}

export interface Env extends AiBindings, MetaBindings, SearchBindings, TelegramBindings {
  DB: D1Database;
  APP_ENV: string;
  SESSION_SECRET?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
}
