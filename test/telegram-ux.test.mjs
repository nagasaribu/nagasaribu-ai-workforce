import test from "node:test";
import assert from "node:assert/strict";
import {
  escapeHtml,
  formatAiContent,
  renderApprovalRequest,
  renderTaskResponse,
  splitHtmlMessage,
} from "../src/telegram-format.ts";
import { buildAgentPrompt } from "../src/orchestrator.ts";
import { sendMessage } from "../src/telegram.ts";

test("HTML escaping blocks injected markup", () => {
  assert.equal(
    escapeHtml('<b>"x" & </b>'),
    "&lt;b&gt;&quot;x&quot; &amp; &lt;/b&gt;",
  );
});

test("AI Markdown is converted to safe Telegram HTML without raw syntax", () => {
  const source = [
    "## Tajuk Laporan",
    "",
    "**Penting** dan <script>alert(1)</script>",
    "",
    "| Segmen | Keperluan |",
    "|---|---|",
    "| Rumah | Bocor |",
    "",
    "- Satu",
    "- Dua",
    "",
    "---",
    "1. Langkah pertama",
  ].join("\n");

  const output = formatAiContent(source);
  assert.match(output, /<b>Tajuk Laporan<\/b>/);
  assert.match(output, /<b>Penting<\/b>/);
  assert.match(output, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(output, /• Segmen · Keperluan/);
  assert.match(output, /• Rumah · Bocor/);
  assert.match(output, /• Satu/);
  assert.match(output, /1\. Langkah pertama/);
  assert.doesNotMatch(output, /<script>/);
  assert.doesNotMatch(output, /\*\*/);
  assert.doesNotMatch(output, /##/);
  assert.doesNotMatch(output, /\|/);
});

test("long HTML output is split into safe Telegram-sized chunks", async () => {
  const html = `<b>${"perkataan panjang ".repeat(800)}</b>`;
  const chunks = splitHtmlMessage(html);
  assert.ok(chunks.length > 1);
  for (const chunk of chunks) {
    assert.ok(chunk.length <= 4096, `chunk too long: ${chunk.length}`);
    const opens = (chunk.match(/<b>/g) ?? []).length;
    const closes = (chunk.match(/<\/b>/g) ?? []).length;
    assert.equal(opens, closes, "HTML tags must remain balanced in each chunk");
  }

  const calls = [];
  const fakeFetch = async (_url, init) => {
    calls.push(JSON.parse(String(init.body)));
    return new Response(JSON.stringify({ ok: true, result: { message_id: calls.length } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  const env = {
    TELEGRAM_BOT_TOKEN: "123:test-token",
    TELEGRAM_API_BASE: "https://telegram.test",
  };
  const result = await sendMessage(
    env,
    { chatId: "1", text: html, parseMode: "HTML" },
    fakeFetch,
  );
  assert.ok(result.sent > 1);
  for (const payload of calls) {
    assert.equal(payload.parse_mode, "HTML");
    assert.ok(payload.text.length <= 4096);
  }
});

test("task responses adapt to human, simple and deep modes", () => {
  const result = [
    "## Ringkasan",
    "",
    "Permintaan pelanggan meningkat 20% pada suku ini.",
    "",
    "- Saluran utama ialah carian tempatan.",
    "- Kos setiap pertanyaan masih rendah.",
    "- Risiko utama ialah kapasiti pasukan.",
    "",
    "Cadangan: fokus pada tiga kawasan dahulu.",
  ].join("\n");
  const base = {
    taskId: "abcd1234-0000-0000-0000-000000000000",
    title: "Analisis saluran pemasaran",
    state: "completed",
    result,
    agentName: "Marketing AI",
    provider: "deepseek",
    model: "deepseek-chat",
  };

  const human = renderTaskResponse({ ...base, mode: "human" });
  assert.match(human, /✅ <b>Analisis saluran pemasaran<\/b>/);
  assert.match(human, /Poin utama/);
  assert.match(human, /🎯 Ejen: Marketing AI/);
  assert.match(human, /\/task #abcd1234/);
  assert.ok(!human.includes("abcd1234-0000"), "full task UUID must not be shown");

  const simple = renderTaskResponse({ ...base, mode: "simple" });
  assert.match(simple, /Poin utama/);
  assert.doesNotMatch(simple, /🔌 Penyedia/);
  assert.ok((simple.match(/^• /gm) ?? []).length <= 3);

  const deep = renderTaskResponse({ ...base, mode: "deep_thinking" });
  assert.match(deep, /🧠 <b>Analisis<\/b>/);
  assert.match(deep, /Permintaan pelanggan meningkat/);
  assert.match(deep, /🔌 Penyedia: deepseek · deepseek-chat/);

  const approval = renderApprovalRequest({
    taskId: "abcd1234-0000-0000-0000-000000000000",
    title: "Hantar WhatsApp kepada pelanggan",
    reason: "Tindakan luaran.",
  });
  assert.match(approval, /🔐 <b>Kelulusan Diperlukan<\/b>/);
  assert.match(approval, /\/confirm #abcd1234/);
});

test("orchestrator prompt receives the selected response mode", () => {
  const agent = {
    id: "agent_test",
    name: "Marketing AI",
    kind: "customer_acquisition",
    description: "Ujian",
    status: "active",
    capabilities: "[]",
    config: "{}",
  };
  const cases = [
    ["human", "Mod jawapan: HUMAN"],
    ["simple", "Mod jawapan: SIMPLE"],
    ["deep_thinking", "Mod jawapan: DEEP_THINKING"],
  ];

  for (const [mode, expected] of cases) {
    const built = buildAgentPrompt(agent, {
      id: "task-1",
      title: "Ujian",
      description: "Ujian prompt",
      priority: "normal",
      metadata: JSON.stringify({ responseMode: mode }),
    });
    assert.ok(built.prompt.includes(expected), `prompt must contain ${expected}`);
  }
});
