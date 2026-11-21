import type { Env } from "../types.ts";
import {
  getProviderStatus,
  ProviderError,
  runDeepSeek,
  type ProviderInput,
  type ProviderResult,
  type ProviderStatus,
} from "./deepseek.ts";
import { getMetaStatus, runMeta, type MetaStatus } from "./meta.ts";

export interface RouterResult extends ProviderResult {
  provider: "deepseek" | "meta";
  fallback: boolean;
  fallbackReason?: string;
}

export interface RouterStatus {
  primary: ProviderStatus & { provider: "deepseek" };
  backup: MetaStatus;
  active: "deepseek" | "meta" | "none";
  fallbackEnabled: boolean;
}

export function getRouterStatus(env: Env): RouterStatus {
  const primary = getProviderStatus(env);
  const backup = getMetaStatus(env);
  return {
    primary: { ...primary, provider: "deepseek" },
    backup,
    active: primary.mode === "live" ? "deepseek" : "none",
    fallbackEnabled: backup.available,
  };
}

function normalizeError(error: unknown, provider: "deepseek" | "meta"): ProviderError {
  if (error instanceof ProviderError) {
    if (!error.provider) error.provider = provider;
    return error;
  }
  return new ProviderError(
    "provider_unreachable",
    provider === "meta" ? "Muse Spark tidak dapat dihubungi." : "DeepSeek tidak dapat dihubungi.",
    502,
    true,
    undefined,
    provider,
  );
}

export async function generateWithFallback(
  env: Env,
  input: ProviderInput,
  fetchImpl: typeof fetch = fetch,
): Promise<RouterResult> {
  try {
    const primary = await runDeepSeek(env, input, fetchImpl);
    return {
      ...primary,
      provider: "deepseek",
      fallback: false,
    };
  } catch (error) {
    const primaryError = normalizeError(error, "deepseek");

    if (!primaryError.retryable) throw primaryError;

    const backup = getMetaStatus(env);
    if (!backup.available) {
      primaryError.fallbackAttempted = false;
      primaryError.fallbackReason = "backup_unavailable";
      throw primaryError;
    }

    try {
      const secondary = await runMeta(env, input, fetchImpl);
      return {
        ...secondary,
        provider: "meta",
        fallback: true,
        fallbackReason: primaryError.code,
      };
    } catch (backupError) {
      const metaError = normalizeError(backupError, "meta");
      metaError.fallbackAttempted = true;
      metaError.fallbackReason = primaryError.code;
      throw metaError;
    }
  }
}
