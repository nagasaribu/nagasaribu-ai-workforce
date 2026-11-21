import {
  MODE_ICONS,
  MODE_LABELS,
  type ResponseMode,
} from "./response-mode.ts";

const HTML_MAX = 3800;

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function inlineFormat(escaped: string): string {
  return escaped
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/__([^_]+)__/g, "<b>$1</b>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*/g, "")
    .replace(/__/g, "");
}

function isTableSeparator(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes("|") || !trimmed.includes("-")) return false;
  return /^[|:\-\s]+$/.test(trimmed) && (trimmed.match(/-/g) ?? []).length >= 3;
}

export function formatAiContent(text: string): string {
  const escaped = escapeHtml(String(text ?? "").replace(/\r\n/g, "\n"));
  const lines = escaped.split("\n");
  const output: string[] = [];

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();
    if (!trimmed) {
      output.push("");
      continue;
    }
    if (isTableSeparator(trimmed) || /^[-*_]{3,}$/.test(trimmed)) continue;

    const heading = /^#{1,6}\s+(.*)$/.exec(trimmed);
    if (heading) {
      output.push(`<b>${inlineFormat(heading[1].trim())}</b>`);
      continue;
    }

    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const cells = trimmed
        .split("|")
        .map((cell) => cell.trim())
        .filter(Boolean);
      if (cells.length) output.push(`• ${cells.map(inlineFormat).join(" · ")}`);
      continue;
    }

    const bullet = /^[-*•]\s+(.*)$/.exec(trimmed);
    if (bullet) {
      output.push(`• ${inlineFormat(bullet[1].trim())}`);
      continue;
    }

    const numbered = /^(\d+)[.)]\s+(.*)$/.exec(trimmed);
    if (numbered) {
      output.push(`${numbered[1]}. ${inlineFormat(numbered[2].trim())}`);
      continue;
    }

    output.push(inlineFormat(trimmed));
  }

  return output.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function plainTextFromAi(text: string): string {
  const lines = String(text ?? "").replace(/\r\n/g, "\n").split("\n");
  const output: string[] = [];
  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed) {
      output.push("");
      continue;
    }
    if (isTableSeparator(trimmed) || /^[-*_]{3,}$/.test(trimmed)) continue;
    const heading = /^#{1,6}\s+(.*)$/.exec(trimmed);
    if (heading) {
      output.push(heading[1].trim());
      continue;
    }
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const cells = trimmed
        .split("|")
        .map((cell) => cell.trim())
        .filter(Boolean);
      if (cells.length) output.push(cells.join(" · "));
      continue;
    }
    const bullet = /^[-*•]\s+(.*)$/.exec(trimmed);
    if (bullet) {
      output.push(bullet[1].trim());
      continue;
    }
    const numbered = /^(\d+)[.)]\s+(.*)$/.exec(trimmed);
    if (numbered) {
      output.push(numbered[2].trim());
      continue;
    }
    output.push(trimmed.replace(/\*\*/g, "").replace(/__/g, "").replace(/`/g, ""));
  }
  return output.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function extractSummary(text: string, max = 240): string {
  const plain = plainTextFromAi(text);
  if (!plain) return "";
  const paragraphs = plain
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const candidate = paragraphs.find((paragraph) => paragraph.length >= 12) ?? paragraphs[0] ?? "";
  const sentence = candidate.split(/(?<=[.!?])\s+/)[0] ?? candidate;
  return sentence.length > max ? `${sentence.slice(0, max - 1).trim()}…` : sentence;
}

export function extractKeyPoints(text: string, max = 3): string[] {
  const rawLines = String(text ?? "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const candidates: string[] = [];
  const clean = (value: string): string =>
    value.replace(/\*\*/g, "").replace(/__/g, "").replace(/`/g, "").trim();

  for (const line of rawLines) {
    if (isTableSeparator(line) || /^[-*_]{3,}$/.test(line)) continue;
    const heading = /^#{1,6}\s+(.*)$/.exec(line);
    const bullet = /^[-*•]\s+(.*)$/.exec(line);
    const numbered = /^(\d+)[.)]\s+(.*)$/.exec(line);
    let candidate = "";
    if (heading) {
      const headingText = clean(heading[1]);
      if (
        !/^(ringkasan|pendahuluan|pengenalan|laporan|analisis|summary|overview|executive summary)$/i.test(
          headingText,
        )
      ) {
        candidate = headingText;
      }
    } else if (bullet) candidate = clean(bullet[1]);
    else if (numbered) candidate = clean(numbered[2]);
    else if (line.startsWith("|") && line.endsWith("|")) {
      candidate = clean(
        line
          .split("|")
          .map((cell) => cell.trim())
          .filter(Boolean)
          .join(" · "),
      );
    }
    if (candidate.length >= 8) candidates.push(candidate);
    if (candidates.length >= max) break;
  }

  if (candidates.length < max) {
    const sentences = plainTextFromAi(text)
      .replace(/\n+/g, " ")
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => clean(sentence))
      .filter((sentence) => sentence.length >= 12);
    for (const sentence of sentences) {
      if (candidates.length >= max) break;
      if (!candidates.includes(sentence)) candidates.push(sentence);
    }
  }

  return candidates
    .slice(0, max)
    .map((point) => (point.length > 170 ? `${point.slice(0, 169)}…` : point));
}

export function taskRef(id: string): string {
  const value = String(id ?? "").trim();
  return value ? `#${value.slice(0, 8)}` : "#—";
}

export function statusVisual(state: string): { icon: string; label: string } {
  switch (String(state ?? "").toLowerCase()) {
    case "completed":
      return { icon: "✅", label: "Selesai" };
    case "failed":
      return { icon: "❌", label: "Gagal" };
    case "blocked":
      return { icon: "⚠️", label: "Perlu perhatian" };
    case "cancelled":
      return { icon: "⚠️", label: "Dibatalkan" };
    case "running":
    case "in_progress":
      return { icon: "⏳", label: "Sedang berjalan" };
    case "assigned":
      return { icon: "⏳", label: "Ditugaskan" };
    default:
      return { icon: "⏳", label: "Menunggu" };
  }
}

export function agentVisual(name: string | undefined): string {
  const value = String(name ?? "").toLowerCase();
  if (value.includes("marketing")) return "🎯";
  if (value.includes("qs")) return "🏗️";
  if (value.includes("finance")) return "💰";
  if (value.includes("creative")) return "🎨";
  if (value.includes("research")) return "🔎";
  if (value.includes("technical")) return "🤖";
  return "🤖";
}

export interface TaskResponseView {
  mode: ResponseMode;
  taskId: string;
  title: string;
  state: string;
  result?: string;
  error?: string;
  agentName?: string;
  provider?: string;
  model?: string;
  approvalRequired?: boolean;
  approvalReason?: string;
  nextAction?: string;
  summary?: string;
}

export function renderApprovalRequest(input: {
  taskId: string;
  title: string;
  reason?: string;
}): string {
  const ref = taskRef(input.taskId);
  return [
    "🔐 <b>Kelulusan Diperlukan</b>",
    "",
    `Rujukan: ${escapeHtml(ref)}`,
    `Tindakan: ${escapeHtml(input.title)}`,
    `Sebab: ${escapeHtml(input.reason || "Arahan ini boleh melibatkan tindakan luaran.")}`,
    "",
    `➡️ Hantar <code>/confirm ${escapeHtml(ref)}</code> untuk memberi pengesahan.`,
    "<i>Tiada tindakan luaran dijalankan sehingga pengesahan diterima.</i>",
  ].join("\n");
}

export function renderTaskResponse(view: TaskResponseView): string {
  if (view.approvalRequired) {
    return renderApprovalRequest({
      taskId: view.taskId,
      title: view.title,
      reason: view.approvalReason,
    });
  }

  const ref = taskRef(view.taskId);
  const visual = statusVisual(view.state);
  const summary =
    view.summary ||
    extractSummary(view.result ?? "") ||
    extractSummary(view.error ?? "") ||
    "Tugasan telah diproses.";
  const points = extractKeyPoints(view.result ?? view.error ?? "", view.mode === "simple" ? 3 : 3);
  const lines = [`${visual.icon} <b>${escapeHtml(view.title)}</b>`, escapeHtml(summary)];

  if (view.error && view.state !== "completed") {
    lines.push(`⚠️ ${escapeHtml(view.error)}`);
  }

  if (view.mode === "deep_thinking") {
    const detailed = formatAiContent(view.result ?? "");
    if (detailed) lines.push("", "🧠 <b>Analisis</b>", detailed);
    if (!detailed && view.error) lines.push("", "⚠️ <b>Risiko / sekatan</b>", escapeHtml(view.error));
  } else if (points.length) {
    lines.push("", "<b>Poin utama</b>", ...points.map((point) => `• ${escapeHtml(point)}`));
  }

  if (view.agentName) {
    lines.push("", `${agentVisual(view.agentName)} Ejen: ${escapeHtml(view.agentName)}`);
  }
  if (view.provider && view.mode !== "simple") {
    const provider = view.model ? `${view.provider} · ${view.model}` : view.provider;
    lines.push(`🔌 Penyedia: ${escapeHtml(provider)}`);
  }
  const nextAction = view.nextAction || `/task ${ref}`;
  lines.push("", `➡️ ${escapeHtml(nextAction)}`);
  return lines.join("\n");
}

export function modeVisual(mode: ResponseMode): { icon: string; label: string } {
  return { icon: MODE_ICONS[mode], label: MODE_LABELS[mode] };
}

export function renderWebTaskResponse(view: TaskResponseView): string {
  const ref = taskRef(view.taskId);
  if (view.approvalRequired) {
    return [
      "🔐 Kelulusan Diperlukan",
      "",
      `Rujukan: ${ref}`,
      `Tindakan: ${view.title}`,
      `Sebab: ${view.approvalReason || "Arahan ini boleh melibatkan tindakan luaran."}`,
      "",
      `Taip /confirm ${ref} atau buka halaman Kelulusan untuk memberi pengesahan.`,
      "Tiada tindakan luaran dijalankan sehingga pengesahan diterima.",
    ].join("\n");
  }

  const visual = statusVisual(view.state);
  const summary =
    view.summary ||
    extractSummary(view.result ?? "") ||
    extractSummary(view.error ?? "") ||
    "Tugasan telah diproses.";
  const points = extractKeyPoints(view.result ?? view.error ?? "", view.mode === "simple" ? 3 : 3);
  const lines: string[] = [];
  if (view.agentName && view.state !== "failed") {
    lines.push(`Baik Dato. Saya serahkan kepada ${view.agentName}.`, "");
  }
  lines.push(`${visual.icon} ${view.title}`, summary);

  if (view.error && view.state !== "completed") {
    lines.push(`⚠️ ${view.error}`);
  }

  if (view.mode === "deep_thinking") {
    const detailed = plainTextFromAi(view.result ?? "");
    if (detailed) lines.push("", "Analisis", detailed);
    if (!detailed && view.error) lines.push("", "Risiko / sekatan", view.error);
  } else if (points.length) {
    lines.push("", "Poin utama", ...points.map((point) => `• ${point}`));
  }

  if (view.agentName) lines.push("", `🤖 Ejen: ${view.agentName}`);
  if (view.provider && view.mode !== "simple") {
    lines.push(
      `🔌 Penyedia: ${view.provider}${view.model ? ` · ${view.model}` : ""}`,
    );
  }
  lines.push("", `➡️ ${view.nextAction || `Taip /task ${ref} untuk butiran penuh.`}`);
  return lines.join("\n");
}


export function splitHtmlMessage(html: string, max = HTML_MAX): string[] {
  const value = String(html ?? "").trim();
  if (!value) return [""];
  const chunks: string[] = [];
  let current = "";
  const stack: Array<{ name: string; open: string }> = [];

  const closeTags = (): string =>
    stack
      .slice()
      .reverse()
      .map((tag) => `</${tag.name}>`)
      .join("");
  const openTags = (): string => stack.map((tag) => tag.open).join("");

  const pushChunk = (): void => {
    if (!current.trim()) return;
    const closing = closeTags();
    const reopening = openTags();
    chunks.push(`${current}${closing}`.trim());
    current = reopening;
  };

  let index = 0;
  while (index < value.length) {
    if (value[index] === "<") {
      const end = value.indexOf(">", index);
      if (end !== -1) {
        const tag = value.slice(index, end + 1);
        if (current.length + tag.length > max && current.trim()) pushChunk();
        current += tag;
        const match = /^<\s*(\/)?\s*([a-z][a-z0-9]*)/i.exec(tag);
        if (match) {
          const closing = Boolean(match[1]);
          const name = match[2].toLowerCase();
          if (closing) {
            const existing = stack.map((entry) => entry.name).lastIndexOf(name);
            if (existing >= 0) stack.splice(existing, 1);
          } else if (!tag.endsWith("/>")) {
            stack.push({ name, open: tag });
          }
        }
        index = end + 1;
        continue;
      }
    }

    let next = value.indexOf("<", index);
    if (next === -1) next = value.length;
    const text = value.slice(index, next);
    const tokens = text.match(/\s+|[^\s]+/g) ?? [];
    for (const token of tokens) {
      if (current.length + token.length > max && current.trim()) pushChunk();
      if (token.length > max) {
        let offset = 0;
        while (offset < token.length) {
          const room = Math.max(1, max - current.length);
          current += token.slice(offset, offset + room);
          offset += room;
          if (offset < token.length) pushChunk();
        }
      } else {
        current += token;
      }
    }
    index = next;
  }

  if (current.trim()) chunks.push(`${current}${closeTags()}`.trim());
  return chunks.length ? chunks : [""];
}
