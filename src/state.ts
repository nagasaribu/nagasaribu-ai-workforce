export const TASK_STATES = [
  "pending",
  "assigned",
  "running",
  "completed",
  "failed",
  "blocked",
  "cancelled",
] as const;

export type TaskState = (typeof TASK_STATES)[number];

const TRANSITIONS: Record<TaskState, TaskState[]> = {
  pending: ["assigned", "blocked", "cancelled"],
  assigned: ["assigned", "running", "blocked", "cancelled"],
  running: ["completed", "failed", "blocked", "cancelled"],
  completed: ["assigned", "running", "blocked", "cancelled"],
  failed: ["assigned", "running", "blocked", "cancelled"],
  blocked: ["assigned", "running", "cancelled"],
  cancelled: [],
};

export const TERMINAL_STATES: TaskState[] = ["completed", "cancelled"];

export function isTaskState(value: unknown): value is TaskState {
  return typeof value === "string" && (TASK_STATES as readonly string[]).includes(value);
}

export function canTransition(from: TaskState, to: TaskState): boolean {
  if (from === to) return true;
  return TRANSITIONS[from].includes(to);
}

export function allowedTransitions(from: TaskState): TaskState[] {
  return [from, ...TRANSITIONS[from]];
}

export function legacyStatus(state: TaskState): string {
  switch (state) {
    case "running":
      return "in_progress";
    case "failed":
      return "blocked";
    default:
      return state;
  }
}

export function stateFromLegacy(status: unknown): TaskState {
  if (status === "in_progress") return "running";
  return isTaskState(status) ? status : "pending";
}

export function stateOfTask(task: Record<string, unknown>): TaskState {
  if (isTaskState(task.execution_state)) return task.execution_state;
  return stateFromLegacy(task.status);
}
