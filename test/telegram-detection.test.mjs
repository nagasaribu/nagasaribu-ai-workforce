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

test("explicit negative instructions do not trigger an external action", () => {
  const safe = [
    "Jangan hantar sebarang mesej",
    "Jangan hantar sebarang mesej kepada pelanggan",
    "Jangan hubungi pelanggan",
    "Jangan telefon prospek",
    "Elakkan menghantar e-mel kepada prospek",
    "Sediakan draf mesej untuk pelanggan. Jangan hantar.",
    "Analisis pelanggan dan sediakan pelan pemasaran 7 hari. Jangan hantar sebarang mesej.",
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
    "telefon prospek",
    "terbitkan iklan",
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
});
