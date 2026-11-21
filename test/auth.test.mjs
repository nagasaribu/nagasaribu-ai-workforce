import test from "node:test";
import assert from "node:assert/strict";
import {
  hashPassword,
  parseCookies,
  signSession,
  verifyPassword,
  verifySession,
} from "../src/auth.ts";

const SECRET = "unit-test-secret-0123456789abcdef";

test("password hashes use a unique salt and verify correctly", async () => {
  const first = await hashPassword("correct horse battery staple");
  const second = await hashPassword("correct horse battery staple");

  assert.match(first, /^pbkdf2\$100000\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/);
  assert.notEqual(first, second, "each hash must use a fresh salt");
  assert.equal(await verifyPassword("correct horse battery staple", first), true);
  assert.equal(await verifyPassword("wrong password", first), false);
});

test("malformed password hashes are rejected without throwing", async () => {
  assert.equal(await verifyPassword("anything", "not-a-hash"), false);
  assert.equal(await verifyPassword("anything", "pbkdf2$abc$salt$hash"), false);
  assert.equal(await verifyPassword("anything", "pbkdf2$100000$%%%$%%%"), false);
});

test("session tokens round-trip and reject tampering", async () => {
  const token = await signSession("user-123", SECRET, 1_700_000_000);
  const payload = await verifySession(token, SECRET, 1_700_000_100);

  assert.equal(payload?.sub, "user-123");
  assert.equal(payload?.iat, 1_700_000_000);
  assert.equal(payload?.exp, 1_700_000_000 + 8 * 60 * 60);

  const tampered = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;
  assert.equal(await verifySession(tampered, SECRET, 1_700_000_100), null);
  assert.equal(await verifySession(token, "different-secret-0123456789", 1_700_000_100), null);
});

test("expired, future and malformed tokens are rejected", async () => {
  const token = await signSession("user-123", SECRET, 1_700_000_000);
  assert.equal(await verifySession(token, SECRET, 1_700_000_000 + 8 * 60 * 60 + 1), null);
  assert.equal(await verifySession(token, SECRET, 1_700_000_000 - 120), null);
  assert.equal(await verifySession("", SECRET), null);
  assert.equal(await verifySession("a.b.c", SECRET), null);
  assert.equal(await verifySession(token, ""), null);
});

test("cookie parsing handles encoded values and ignores malformed pairs", () => {
  const cookies = parseCookies("occ_session=abc%2Edef; theme=dark; broken; =empty");
  assert.equal(cookies.occ_session, "abc.def");
  assert.equal(cookies.theme, "dark");
  assert.equal(cookies.broken, undefined);
});
