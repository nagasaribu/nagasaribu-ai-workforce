import test from "node:test";
import assert from "node:assert/strict";
import { isExternalAction } from "../src/telegram.ts";

test("customer and marketing analysis language is not an external action", () => {
  const safe = [
    "pelanggan",
    "sasaran pelanggan",
    "cari pelanggan",
    "cari pelanggan waterproofing",
    "mendapatkan pelanggan",
    "analisis pelanggan",
    "analisis pelanggan waterproofing",
    "pelan pemasaran",
    "pelan pemasaran 7 hari",
    "strategi pemasaran",
    "draf mesej",
    "cadangan kempen",
    "draf cadangan kempen pemasaran",
    "Sediakan draf sahaja",
    "Analisis sahaja",
  ];

  for (const text of safe) {
    assert.equal(isExternalAction(text), false, `must not require approval: ${text}`);
  }
});

test("negation scope survives coordinated action lists", () => {
  const safe = [
    "Jangan hantar mesej, hubungi pelanggan atau terbitkan iklan.",
    "Jangan hantar mesej atau hubungi prospek.",
    "Analisis sahaja. Jangan hantar, hubungi atau terbitkan.",
    "Prepare a marketing strategy. Do not send messages, contact customers, or publish ads.",
    "Analisis dan sediakan laporan sahaja. Jangan hantar mesej,\nhubungi pelanggan atau terbitkan iklan.",
  ];

  for (const text of safe) {
    assert.equal(isExternalAction(text), false, `must not require approval: ${text}`);
  }
});

test("the complete production Telegram instruction is analysis-only", () => {
  const completeMessage = [
    "SARA,",
    "",
    "Tugaskan Marketing AI untuk menyediakan pelan pemasaran 7 hari bagi perkhidmatan waterproofing di Selangor dan Kuala Lumpur.",
    "",
    "Saya mahu:",
    "1. Strategi mendapatkan pelanggan.",
    "2. Sasaran pasaran.",
    "3. Lima saluran pemasaran.",
    "4. Aktiviti harian.",
    "5. Anggaran kos dan potensi jualan.",
    "",
    "Analisis dan sediakan laporan sahaja. Jangan hantar mesej, hubungi pelanggan atau terbitkan iklan.",
  ].join("\n");

  assert.equal(isExternalAction(completeMessage), false);
});

test("explicit negative instructions do not trigger an external action", () => {
  const safe = [
    "Jangan hantar sebarang mesej",
    "Jangan hantar sebarang mesej kepada pelanggan",
    "Jangan hubungi pelanggan",
    "Jangan telefon prospek",
    "Elakkan menghantar e-mel kepada prospek",
    "Sediakan draf mesej untuk pelanggan. Jangan hantar.",
    "Analisis pelanggan dan sediakan pelan pemasaran 7 hari. Jangan hantar sebarang mesej.",
    "Analisis prospek dan sediakan draf mesej, tetapi jangan hantar kepada pelanggan.",
  ];

  for (const text of safe) {
    assert.equal(isExternalAction(text), false, `must not require approval: ${text}`);
  }
});

test("genuine external actions still require approval", () => {
  const external = [
    "hantar WhatsApp kepada pelanggan",
    "hantar e-mel kepada prospek",
    "hubungi pelanggan",
    "hubungi prospek untuk mendapatkan projek",
    "telefon prospek",
    "terbitkan iklan",
    "terbitkan iklan waterproofing",
    "laksanakan kempen pemasaran",
    "buat pembayaran",
    "beli atau langgan perkhidmatan",
    "Hantar mesej kepada pelanggan",
    "Hantar invois kepada pelanggan",
    "Tandatangan kontrak dengan pembekal",
    "Laksanakan kempen",
  ];

  for (const text of external) {
    assert.equal(isExternalAction(text), true, `must require approval: ${text}`);
  }
});

test("negation only suppresses the negated clause, not a separate positive action", () => {
  assert.equal(
    isExternalAction("Jangan hantar mesej kepada pelanggan. Hubungi pelanggan untuk pengesahan."),
    true,
    "a separate positive contact instruction must still be gated",
  );
  assert.equal(
    isExternalAction("Jangan hantar mesej tetapi hantar WhatsApp kepada pelanggan."),
    true,
    "a separate positive send instruction must still be gated",
  );
  assert.equal(
    isExternalAction("Jangan buat pembayaran, hantar WhatsApp kepada pelanggan."),
    true,
    "a later positive send action must still be gated",
  );
  assert.equal(
    isExternalAction("Hantar WhatsApp, jangan hantar e-mel."),
    true,
    "a positive action before a negated action must still be gated",
  );
});
