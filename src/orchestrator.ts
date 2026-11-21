import type { Env } from "./types.ts";
import { runDeepSeek, type ProviderResult } from "./providers/deepseek.ts";

export interface AgentRecord {
  id: string;
  name: string;
  kind: string;
  description: string;
  status: string;
  capabilities: string;
  config: string;
}

export interface AgentSelection {
  agent: AgentRecord;
  reason: "assigned" | "capability" | "orchestrator" | "default";
}

export type TaskRecord = Record<string, unknown>;

export function parseJsonObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "string" || !value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export function parseCapabilities(agent: AgentRecord): string[] {
  if (typeof agent.capabilities !== "string") return [];
  try {
    const parsed = JSON.parse(agent.capabilities) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function parseAgentConfig(agent: AgentRecord): Record<string, unknown> {
  return parseJsonObject(agent.config);
}

export async function selectAgentForTask(env: Env, task: TaskRecord): Promise<AgentSelection | null> {
  const result = await env.DB.prepare(
    `SELECT id, name, kind, description, status, capabilities, config
     FROM agent_registry ORDER BY created_at ASC`,
  ).all<AgentRecord>();
  const agents = result.results;
  if (!agents.length) return null;

  const assignedId = typeof task.assigned_agent_id === "string" ? task.assigned_agent_id : "";
  if (assignedId) {
    const assigned = agents.find((agent) => agent.id === assignedId);
    if (assigned) return { agent: assigned, reason: "assigned" };
  }

  const metadata = parseJsonObject(task.metadata);
  const capability = typeof metadata.capability === "string" ? metadata.capability.trim() : "";
  if (capability) {
    const match = agents.find(
      (agent) => agent.status === "active" && parseCapabilities(agent).includes(capability),
    );
    if (match) return { agent: match, reason: "capability" };
  }

  const sara = agents.find(
    (agent) =>
      agent.status === "active" &&
      (agent.kind === "orchestrator" || agent.name.trim().toUpperCase() === "SARA"),
  );
  if (sara) return { agent: sara, reason: "orchestrator" };

  const fallback = agents.find((agent) => agent.status === "active");
  return fallback ? { agent: fallback, reason: "default" } : null;
}

export function buildAgentPrompt(
  agent: AgentRecord,
  task: TaskRecord,
  toolOutput?: unknown,
): {
  systemPrompt: string;
  prompt: string;
} {
  const config = parseAgentConfig(agent);
  const metadata = parseJsonObject(task.metadata);
  const systemPrompt =
    typeof config.systemPrompt === "string" && config.systemPrompt.trim()
      ? config.systemPrompt
      : "Anda ialah ejen AI dalam NAGASARIBU AI WORKFORCE. Beri output operasi yang tepat, ringkas dan boleh dilaksanakan dalam Bahasa Melayu. Jangan mereka data pelanggan atau fakta.";

  const lines = [
    `Tugas: ${String(task.title ?? "")}`,
    `Keterangan: ${String(task.description ?? "") || "-"}`,
    `Keutamaan: ${String(task.priority ?? "normal")}`,
  ];

  if (typeof metadata.capability === "string" && metadata.capability) {
    lines.push(`Keupayaan diperlukan: ${metadata.capability}`);
  }
  if (metadata.requiresApproval === true) {
    lines.push("Nota tadbir: tindakan luaran ini memerlukan kelulusan manusia sebelum diteruskan.");
  }
  if (toolOutput !== undefined) {
    lines.push(
      "",
      "Hasil alat dalaman (sumber benar, jangan cipta semula):",
      JSON.stringify(toolOutput).slice(0, 5000),
    );
  }

  lines.push(
    "",
    "Hasilkan output operasi yang ringkas dan boleh dilaksanakan dalam Bahasa Melayu.",
    "Jangan mereka data pelanggan, keputusan kewangan atau fakta. Nyatakan andaian dan langkah seterusnya.",
  );

  return { systemPrompt, prompt: lines.join("\n") };
}

export async function executeAgent(
  env: Env,
  agent: AgentRecord,
  task: TaskRecord,
  toolOutput?: unknown,
): Promise<ProviderResult> {
  const config = parseAgentConfig(agent);
  const model = typeof config.model === "string" ? config.model : undefined;
  const maxTokens = typeof config.maxTokens === "number" ? config.maxTokens : undefined;
  const built = buildAgentPrompt(agent, task, toolOutput);

  return runDeepSeek(
    { ...env, DEEPSEEK_MODEL: model || env.DEEPSEEK_MODEL },
    {
      systemPrompt: built.systemPrompt,
      prompt: built.prompt,
      maxTokens,
    },
  );
}
