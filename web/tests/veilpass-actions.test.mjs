import assert from "node:assert/strict";
import test from "node:test";
import {
  LAST_PASS_KEY,
  OPEN_NOTE_PLACEHOLDER,
  PENDING_PASS_KEY,
  buildMembershipActions,
  parseStoredPass,
} from "../src/lib/veilpass-actions.mjs";

const hex = (value) => (typeof value === "string" && value.startsWith("0x")
  ? value
  : `0x${BigInt(value).toString(16)}`);

test("builds the canonical withdraw, open-note, invoke sequence", () => {
  const actions = buildMembershipActions({
    token: "0x111",
    helper: "0x222",
    creator: "0x333",
    amount: 100n,
    commitment: "0x444",
    expiry: 999,
    toHex: hex,
  });

  assert.deepEqual(actions.map((action) => action.type), ["withdraw", "transfer", "invoke"]);
  assert.equal(actions[0].recipient, "0x222");
  assert.equal(actions[1].recipient, "0x333");
  assert.equal(actions[1].amount, "OPEN");
});

test("keeps the wallet-resolved note id as the final helper felt", () => {
  const actions = buildMembershipActions({
    token: "0x111",
    helper: "0x222",
    creator: "0x333",
    amount: 100n,
    commitment: "0x444",
    expiry: 999,
    toHex: hex,
  });
  const invoke = actions[2];

  assert.equal(invoke.calldata.at(-1), OPEN_NOTE_PLACEHOLDER);
  assert.deepEqual(invoke.calldata, ["0x111", "0x64", "0x444", "0x3e7", "${openNoteIds[0]}"]);
  assert.equal(invoke.calldata.includes("0x333"), false, "creator must not enter helper calldata");
});

test("accepts a recoverable pending pass without a transaction hash", () => {
  const pass = {
    secret: "0x123",
    commitment: "0x456",
    expiry: 1_800_000_000,
    transactionHash: "",
  };

  assert.deepEqual(parseStoredPass(JSON.stringify(pass)), pass);
  assert.equal(LAST_PASS_KEY, "veilpass:last-pass");
  assert.equal(PENDING_PASS_KEY, "veilpass:pending-pass");
});

test("rejects malformed local pass state", () => {
  assert.equal(parseStoredPass("not json"), undefined);
  assert.equal(parseStoredPass(JSON.stringify({ secret: "hello" })), undefined);
  assert.equal(parseStoredPass(JSON.stringify({
    secret: "0x123",
    commitment: "0x456",
    expiry: -1,
    transactionHash: "0x789",
  })), undefined);
});
