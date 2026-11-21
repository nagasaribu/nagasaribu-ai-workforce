import type { Env } from "./types.ts";
import type { TaskRecord } from "./orchestrator.ts";

export type ToolRisk = "safe" | "approval_required";

export interface ToolDefinition {
  name: string;
  description: string;
  risk: ToolRisk;
  execute?: (env: Env, task: TaskRecord) => Promise<unknown>;
}

export class ToolError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ToolError";
    this.code = code;
  }
}

export const TOOLS: Record<string, ToolDefinition> = {
  registry_snapshot: {
    name: "registry_snapshot",
    description: "Senarai ejen aktif dan keupayaan mereka. Baca sahaja.",
    risk: "safe",
    async execute(env: Env): Promise<unknown> {
      const result = await env.DB.prepare(
        `SELECT id, name, kind, status, capabilities
         FROM agent_registry WHERE status = 'active' ORDER BY name ASC`,
      ).all<Record<string, unknown>>();
      return { agents: result.results };
    },
  },
  task_context: {
    name: "task_context",
    description: "Konteks tugas semasa dan peristiwa terkini. Baca sahaja.",
    risk: "safe",
    async execute(env: Env, task: TaskRecord): Promise<unknown> {
      const taskId = typeof task.id === "string" ? task.id : "";
      const events = await env.DB.prepare(
        `SELECT event_type, message, created_at
         FROM task_events WHERE task_id = ? ORDER BY created_at DESC LIMIT 10`,
      )
        .bind(taskId)
        .all<Record<string, unknown>>();
      return {
        task: {
          id: taskId,
          title: task.title,
          description: task.description,
          priority: task.priority,
          execution_state: task.execution_state,
          assigned_agent_id: task.assigned_agent_id,
        },
        recentEvents: events.results,
      };
    },
  },
  lead_summary: {
    name: "lead_summary",
    description: "Kiraan prospek mengikut status tanpa data hubungan. Baca sahaja.",
    risk: "safe",
    async execute(env: Env): Promise<unknown> {
      const result = await env.DB.prepare(
        `SELECT status, COUNT(*) AS count FROM leads GROUP BY status ORDER BY status ASC`,
      ).all<Record<string, unknown>>();
      const total = await env.DB.prepare("SELECT COUNT(*) AS count FROM leads").first<{ count: number }>();
      return { total: Number(total?.count ?? 0), byStatus: result.results };
    },
  },
  external_publish: {
    name: "external_publish",
    description: "Terbitkan kandungan ke saluran luaran. Memerlukan kelulusan dan integrasi.",
    risk: "approval_required",
  },
  send_campaign: {
    name: "send_campaign",
    description: "Hantar kempen kepada prospek. Memerlukan kelulusan dan integrasi.",
    risk: "approval_required",
  },
  payment: {
    name: "payment",
    description: "Jalankan pembayaran. Memerlukan kelulusan dan integrasi kewangan.",
    risk: "approval_required",
  },
};

export function getTool(name: string): ToolDefinition | null {
  return TOOLS[name] ?? null;
}

export function isToolName(value: unknown): value is string {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(TOOLS, value);
}

export async function runSafeTool(
  env: Env,
  task: TaskRecord,
  name: string,
): Promise<unknown> {
  const tool = getTool(name);
  if (!tool) throw new ToolError("tool_not_found", "Alat tidak dijumpai.");
  if (tool.risk !== "safe" || !tool.execute) {
    throw new ToolError("tool_not_safe", "Alat ini tidak dibenarkan untuk pelaksanaan automatik.");
  }
  try {
    return await tool.execute(env, task);
  } catch (error) {
    if (error instanceof ToolError) throw error;
    throw new ToolError("tool_failed", "Alat dalaman gagal dijalankan.");
  }
}
