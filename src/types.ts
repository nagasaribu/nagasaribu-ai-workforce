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

export interface Env {
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
