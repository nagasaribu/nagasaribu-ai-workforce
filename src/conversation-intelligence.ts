import { modeInstruction, type ResponseMode } from "./response-mode.ts";
import { isExternalAction } from "./telegram.ts";

export type Intent =
  | "conversation"
  | "internal_work"
  | "read_only_system_query"
  | "external_action";

export interface ConversationTurn {
  role: string;
  content: string;
}

export interface ConversationRequest {
  systemPrompt: string;
  prompt: string;
}

export const SARA_SYSTEM_PROMPT = [
  "Anda ialah SARA, pembantu eksekutif AI NAGASARIBU AI WORKFORCE.",
  "Anda bukan manusia dan tidak boleh mendakwa diri sebagai manusia.",
  "",
  "Gaya:",
  "- Bahasa Melayu semula jadi, mesra, cerdas dan profesional.",
  "- Konversasi, bukan birokratik. Jangan mulakan setiap jawapan dengan pengenalan berulang.",
  "- Jawab soalan mudah secara langsung.",
  "- Jangan paksa tajuk atau senarai poin dalam setiap jawapan.",
  "- Gunakan sejarah perbualan untuk memahami rujukan seperti 'projek itu', 'pelanggan tadi' atau soalan susulan.",
  "- Tanya hanya satu soalan penjelasan yang benar-benar berguna jika maklumat kritikal tiada.",
  "",
  "Ketepatan:",
  "- Jangan reka data operasi, nama pelanggan, angka kewangan, status sistem atau fakta.",
  "- Jika data tidak diberikan atau tidak tersedia, nyatakan dengan jujur dan minta maklumat yang diperlukan.",
  "- Jangan mendakwa sesuatu sudah disahkan atau dilaksanakan tanpa bukti daripada sistem.",
  "",
  "Tindakan:",
  "- Tindakan luaran seperti menghantar mesej, menerbitkan kandungan, pembayaran atau komitmen tidak boleh dijalankan tanpa pengesahan eksplisit.",
  "- Jika pengguna meminta tindakan luaran, jelaskan bahawa pengesahan diperlukan.",
].join("\n");

const STATUS_QUERY_RE =
  /\b(status|kesihatan|health|keadaan)\b[^.!?;\n]{0,80}\b(sistem|worker|d1|database|pangkalan data|ai|provider|telegram|operasi)\b|\b(semak|check)\b[^.!?;\n]{0,50}\b(status|kesihatan|health)\b|\b(status|kesihatan|health)\s+(sistem|worker|d1|database|ai|provider|telegram)\b|\b(tugasan|task)\b[^.!?;\n]{0,40}\b(terkini|sekarang|aktif)\b|\b(ejen|agent)\b[^.!?;\n]{0,40}\b(aktif|status)\b|\b(kelulusan|approval)\b[^.!?;\n]{0,40}\b(menunggu|pending)\b|\b(audit)\b[^.!?;\n]{0,40}\b(terkini|recent)\b|\b(berapa|how many)\b[^.!?;\n]{0,40}\b(tugasan|task|ejen|agent|kelulusan|approval)\b/i;

const INTERNAL_WORK_START_RE =
  /^(cari|carikan|analisis|analisa|kira|hitung|sediakan|siapkan|jana|draf|tulis|hasilkan|bina|susun|kaji|selidik|bandingkan|buat|rancang|rancangkan|tugaskan|gunakan|assign|ringkaskan|generate|create|draft|analy[sz]e|calculate|prepare|build|find|search)\b/i;

const INTERNAL_WORK_PHRASE_RE =
  /\b(cari\s+\d+\s+\w+|cari\s+\w+\s+(prospek|pelanggan|lead)|sediakan\s+(bq|bill of quantities|laporan|pelan|strategi|anggaran|draf|analisis|ringkasan)|buat\s+(analisis|laporan|pengiraan|bq|draf|ringkasan)|analisis\s+(kos|kewangan|pasaran|prospek|data)|kira\s+(margin|kos|untung|bajet|pulangan)|hitung\s+(kos|margin|bajet|pulangan)|jana\s+(kandungan|laporan|draf)|draf\s+(mesej|kandungan|surat|laporan)|beri(?:kan)?\s+cadangan)\b/i;

export function classifyIntent(text: string): Intent {
  const normalized = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) return "conversation";

  if (isExternalAction(normalized)) return "external_action";
  if (STATUS_QUERY_RE.test(normalized)) return "read_only_system_query";

  const stripped = normalized
    .toLowerCase()
    .replace(/^(sara|hai|hello|hi|assalamualaikum|salam)[,!. ]*/i, "")
    .replace(/^(tolong|sila|boleh|please|mohon)\s+/i, "")
    .trim();

  if (INTERNAL_WORK_START_RE.test(stripped) || INTERNAL_WORK_PHRASE_RE.test(stripped)) {
    return "internal_work";
  }

  return "conversation";
}

export function selectConversationContext(
  messages: ConversationTurn[],
  maxMessages: number,
  maxChars: number,
): ConversationTurn[] {
  const relevant = messages
    .filter((message) => (message.role === "user" || message.role === "assistant") && message.content.trim())
    .slice(-Math.max(1, maxMessages));

  let total = 0;
  const selected: ConversationTurn[] = [];
  for (let index = relevant.length - 1; index >= 0; index -= 1) {
    const message = relevant[index];
    const size = message.content.length;
    if (selected.length && total + size > maxChars) break;
    selected.unshift(message);
    total += size;
  }
  return selected;
}

export function buildConversationRequest(input: {
  history: ConversationTurn[];
  userMessage: string;
  mode: ResponseMode;
  systemData?: string;
}): ConversationRequest {
  const lines: string[] = [];
  if (input.history.length) {
    lines.push("Sejarah perbualan terkini (paling lama ke terbaharu):");
    for (const turn of input.history) {
      lines.push(`${turn.role === "user" ? "Pengguna" : "SARA"}: ${turn.content}`);
    }
    lines.push("");
  }
  lines.push(`Pengguna: ${input.userMessage}`);
  lines.push("SARA:");

  const systemParts = [SARA_SYSTEM_PROMPT, modeInstruction(input.mode)];
  if (input.systemData) {
    systemParts.push(
      [
        "Data sistem sebenar yang telah diperiksa:",
        input.systemData,
        "",
        "Gunakan data ini sahaja untuk soalan status. Jangan tambah fakta yang tiada dalam data.",
      ].join("\n"),
    );
  }

  return {
    systemPrompt: systemParts.join("\n\n"),
    prompt: lines.join("\n"),
  };
}
