import assert from "node:assert/strict";
import test from "node:test";
import { hash, num } from "starknet";
import { verifyMembership } from "../src/lib/verify-membership.mjs";

const HELPER = "0x123";
const SECRET = "0x456";
const OFFER = "0x789";
const STARTED = 1_800_000_000;
const DURATION = 30 * 24 * 60 * 60;
const NOTE = "0xabc";

function providerFor(overrides = {}) {
  const commitment = num.toHex(hash.computePoseidonHashOnElements([SECRET]));
  const values = {
    get_started: STARTED,
    get_expiry: STARTED + DURATION,
    get_offer: OFFER,
    get_note: NOTE,
    ...overrides,
  };
  return {
    commitment,
    calls: [],
    async callContract(call) {
      this.calls.push(call);
      return [num.toHex(values[call.entrypoint])];
    },
  };
}

test("accepts an active exact offer only after the creator confirms receipt", async () => {
  const provider = providerFor();
  const checkedNotes = [];
  const result = await verifyMembership({
    provider,
    helper: HELPER,
    secret: SECRET,
    expectedOfferCommitment: OFFER,
    expectedDurationSeconds: DURATION,
    nowSeconds: STARTED + 1,
    receivedNote: async (noteId) => {
      checkedNotes.push(noteId);
      return true;
    },
  });

  assert.equal(result.valid, true);
  assert.equal(result.reason, "active");
  assert.equal(result.commitment, provider.commitment);
  assert.equal(result.startedAt, STARTED);
  assert.equal(result.expiresAt, STARTED + DURATION);
  assert.equal(result.offerCommitment, OFFER);
  assert.equal(result.noteId, NOTE);
  assert.deepEqual(checkedNotes, [NOTE]);
  assert.deepEqual(
    provider.calls.map((call) => call.entrypoint),
    ["get_started", "get_expiry", "get_offer", "get_note"],
  );
  assert.equal(provider.calls.every((call) => call.contractAddress === HELPER), true);
  assert.equal(provider.calls.every((call) => call.calldata[0] === provider.commitment), true);
});

test("rejects a different creator offer before checking private receipt", async () => {
  let receiptChecks = 0;
  const result = await verifyMembership({
    provider: providerFor({ get_offer: "0x999" }),
    helper: HELPER,
    secret: SECRET,
    expectedOfferCommitment: OFFER,
    expectedDurationSeconds: DURATION,
    nowSeconds: STARTED + 1,
    receivedNote: async () => { receiptChecks += 1; return true; },
  });

  assert.equal(result.valid, false);
  assert.equal(result.reason, "offer-mismatch");
  assert.equal(receiptChecks, 0);
});

test("rejects a stretched term even while the membership is active", async () => {
  const result = await verifyMembership({
    provider: providerFor({ get_expiry: STARTED + DURATION + 1 }),
    helper: HELPER,
    secret: SECRET,
    expectedOfferCommitment: OFFER,
    expectedDurationSeconds: DURATION,
    nowSeconds: STARTED + 1,
    receivedNote: async () => true,
  });

  assert.equal(result.valid, false);
  assert.equal(result.reason, "duration-mismatch");
});

test("rejects expired and missing memberships", async () => {
  const expired = await verifyMembership({
    provider: providerFor(),
    helper: HELPER,
    secret: SECRET,
    expectedOfferCommitment: OFFER,
    expectedDurationSeconds: DURATION,
    nowSeconds: STARTED + DURATION,
    receivedNote: async () => true,
  });
  const missing = await verifyMembership({
    provider: providerFor({ get_started: 0, get_expiry: 0, get_offer: 0, get_note: 0 }),
    helper: HELPER,
    secret: SECRET,
    expectedOfferCommitment: OFFER,
    expectedDurationSeconds: DURATION,
    nowSeconds: STARTED,
    receivedNote: async () => true,
  });

  assert.equal(expired.valid, false);
  assert.equal(expired.reason, "expired");
  assert.equal(missing.valid, false);
  assert.equal(missing.reason, "not-found");
});

test("rejects a note the creator wallet cannot confirm receiving", async () => {
  const result = await verifyMembership({
    provider: providerFor(),
    helper: HELPER,
    secret: SECRET,
    expectedOfferCommitment: OFFER,
    expectedDurationSeconds: DURATION,
    nowSeconds: STARTED + 1,
    receivedNote: async () => false,
  });

  assert.equal(result.valid, false);
  assert.equal(result.reason, "note-not-received");
});

test("requires publisher receipt verification and well-formed inputs", async () => {
  await assert.rejects(
    verifyMembership({
      provider: providerFor(),
      helper: HELPER,
      secret: SECRET,
      expectedOfferCommitment: OFFER,
      expectedDurationSeconds: DURATION,
    }),
    /receivedNote callback/,
  );
  await assert.rejects(
    verifyMembership({
      provider: providerFor(),
      helper: "hello",
      secret: SECRET,
      expectedOfferCommitment: OFFER,
      expectedDurationSeconds: DURATION,
      receivedNote: async () => true,
    }),
    /helper/,
  );
});
