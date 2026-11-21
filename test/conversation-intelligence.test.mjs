import test from "node:test";
import assert from "node:assert/strict";
import {
  SARA_SYSTEM_PROMPT,
  buildConversationRequest,
  classifyIntent,
  selectConversationContext,
} from "../src/conversation-intelligence.ts";

test("intent classification distinguishes conversation, status, work and external actions", () => {
  const cases = [
    ["Hai SARA", "conversation"],
    ["Apa pendapat awak?", "conversation"],
    ["Bagaimana strategi pemasaran kita?", "conversation"],
    ["Berapa margin projek ini?", "conversation"],
    ["Semak status sistem kita", "read_only_system_query"],
    ["Bagaimana status AI dan Telegram sekarang?", "read_only_system_query"],
    ["Cari 20 prospek waterproofing", "internal_work"],
    ["Sediakan BQ projek ini", "internal_work"],
    ["Tugaskan Marketing AI untuk menyediakan pelan pemasaran", "internal_work"],
    ["Hantar WhatsApp kepada pelanggan", "external_action"],
    ["Jangan hantar sebarang mesej kepada pelanggan", "conversation"],
  ];

  for (const [text, expected] of cases) {
    assert.equal(classifyIntent(text), expected, `intent for: ${text}`);
  }
});

test("conversation requests include prior turns and project references", () => {
  const history = [
    { role: "user", content: "Projek Alpha ialah projek waterproofing di Selangor." },
    { role: "assistant", content: "Baik Dato. Saya catat konteks Projek Alpha." },
  ];
  const request = buildConversationRequest({
    history,
    userMessage: "Bagaimana margin projek itu?",
    mode: "human",
  });
  assert.match(request.prompt, /Projek Alpha/);
  assert.match(request.prompt, /Bagaimana margin projek itu\?/);
  assert.match(request.prompt, /SARA:/);
  assert.match(request.systemPrompt, /Jangan reka data operasi/);
  assert.match(request.systemPrompt, /Mod jawapan: HUMAN/);
});

test("conversation context is bounded by message count and character budget", () => {
  const history = Array.from({ length: 10 }, (_, index) => ({
    role: index % 2 === 0 ? "user" : "assistant",
    content: `mesej-${index} ` + "x".repeat(100),
  }));
  const selected = selectConversationContext(history, 4, 450);
  assert.ok(selected.length <= 4);
  const total = selected.reduce((sum, turn) => sum + turn.content.length, 0);
  assert.ok(total <= 450 || selected.length === 1);
  assert.equal(selected[selected.length - 1].content.startsWith("mesej-9"), true);
});

test("system status data is supplied explicitly to the model prompt", () => {
  const request = buildConversationRequest({
    history: [],
    userMessage: "Semak status sistem",
    mode: "simple",
    systemData: "D1: sihat; DeepSeek: live; tugas aktif: 3; kelulusan: 1",
  });
  assert.match(request.systemPrompt, /Data sistem sebenar/);
  assert.match(request.systemPrompt, /D1: sihat/);
  assert.match(request.systemPrompt, /Jangan tambah fakta/);
  assert.match(request.systemPrompt, /Mod jawapan: SIMPLE/);
});

test("SARA persona forbids fabricating operational information", () => {
  assert.match(SARA_SYSTEM_PROMPT, /Jangan reka data operasi/);
  assert.match(SARA_SYSTEM_PROMPT, /bukan manusia/);
  assert.match(SARA_SYSTEM_PROMPT, /pengesahan eksplisit/);
});
