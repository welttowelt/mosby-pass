import assert from "node:assert/strict";
import test from "node:test";
import {
  LAST_PASS_KEY,
  OPEN_NOTE_PLACEHOLDER,
  PENDING_PASS_KEY,
  buildAdmissionActions,
  parseStoredPass,
  parseTokenAmount,
} from "../src/lib/veilpass-actions.mjs";
import {
  buildEventOfferUrl,
  createGateChallenge,
  generateAdmissionCredential,
  parseEventOffer,
  signGateChallenge,
  verifyGateProof,
} from "../src/lib/event-pass.mjs";

const hex = (value) => typeof value === "string" && value.startsWith("0x")
  ? value
  : `0x${BigInt(value).toString(16)}`;

test("builds the canonical private-payment admission sequence", () => {
  const actions = buildAdmissionActions({
    token: "0x111", helper: "0x222", creator: "0x333", amount: 100n,
    commitment: "0x444", offerCommitment: "0x555", durationSeconds: 999, toHex: hex,
  });
  assert.deepEqual(actions.map((action) => action.type), ["withdraw", "transfer", "invoke"]);
  assert.equal(actions[0].recipient, "0x222");
  assert.equal(actions[1].recipient, "0x333");
  assert.equal(actions[1].amount, "OPEN");
  assert.deepEqual(actions[2].calldata, ["0x111", "0x64", "0x444", "0x3e7", "0x555", OPEN_NOTE_PLACEHOLDER]);
  assert.equal(actions[2].calldata.includes("0x333"), false, "organizer must not enter helper calldata");
});

test("round-trips all event terms and rejects tampered windows", () => {
  const url = buildEventOfferUrl({
    baseUrl: "https://example.com/veilpass/?stale=1#old", organizer: "0x333", amount: "0.1",
    title: "Midnight Assembly", venue: "Hall 20", startsAt: 1_800_000_000,
    closesAt: 1_800_010_800, nonce: "0xabc",
  });
  const parsed = parseEventOffer(new URL(url).search, (value) => value.toLowerCase(), parseTokenAmount);
  assert.equal(parsed.title, "Midnight Assembly");
  assert.equal(parsed.venue, "Hall 20");
  assert.equal(parsed.organizer, "0x333");
  assert.equal(parsed.amount, 100000000000000000n);
  assert.match(parsed.commitment, /^0x[0-9a-f]+$/);
  assert.equal(url.includes("stale"), false);
  const tampered = new URL(url);
  tampered.searchParams.set("closes", "1799999999");
  assert.equal(parseEventOffer(tampered.search, (value) => value, parseTokenAmount), undefined);
});

test("stores a recoverable device-bound admission pass", async () => {
  const credential = await generateAdmissionCredential();
  const pass = {
    ...credential, offerCommitment: "0x654", eventTitle: "Midnight Assembly", venue: "Hall 20",
    startsAt: 1_800_000_000, closesAt: 1_800_010_800, transactionHash: "",
  };
  assert.deepEqual(parseStoredPass(JSON.stringify(pass)), pass);
  assert.equal(LAST_PASS_KEY, "veilpass:last-pass");
  assert.equal(PENDING_PASS_KEY, "veilpass:pending-pass");
});

test("rejects malformed local pass state", () => {
  assert.equal(parseStoredPass("not json"), undefined);
  assert.equal(parseStoredPass(JSON.stringify({ commitment: "0x123" })), undefined);
});

test("fresh challenge proves device-key possession and rejects payload changes", async () => {
  const credential = await generateAdmissionCredential();
  const pass = {
    ...credential, offerCommitment: "0x654", eventTitle: "Midnight Assembly", venue: "Hall 20",
    startsAt: 1_800_000_000, closesAt: 1_800_010_800, transactionHash: "0x999",
  };
  const challenge = createGateChallenge(pass.offerCommitment, 1_800_000_100);
  const proof = await signGateChallenge(pass, challenge);
  const accepted = await verifyGateProof(proof, challenge, 1_800_000_101);
  assert.equal(accepted.valid, true);
  assert.equal(accepted.commitment, pass.commitment);
  const otherChallenge = { ...challenge, nonce: "0x123" };
  assert.deepEqual(await verifyGateProof(proof, otherChallenge, 1_800_000_101), {
    valid: false,
    reason: "challenge-mismatch",
  });
});

test("rejects stale gate challenges and over-precision amounts", async () => {
  const credential = await generateAdmissionCredential();
  const pass = {
    ...credential, offerCommitment: "0x654", eventTitle: "Midnight Assembly", venue: "Hall 20",
    startsAt: 1_800_000_000, closesAt: 1_800_010_800, transactionHash: "0x999",
  };
  const challenge = createGateChallenge(pass.offerCommitment, 1_800_000_000);
  const proof = await signGateChallenge(pass, challenge);
  assert.equal((await verifyGateProof(proof, challenge, 1_800_000_301)).reason, "stale-challenge");
  assert.throws(() => parseTokenAmount("0.0000000000000000001"), /18 decimal places/);
});

test("rejects a forged signature and a substituted access commitment", async () => {
  const credential = await generateAdmissionCredential();
  const pass = {
    ...credential, offerCommitment: "0x654", eventTitle: "Midnight Assembly", venue: "Hall 20",
    startsAt: 1_800_000_000, closesAt: 1_800_010_800, transactionHash: "0x999",
  };
  const challenge = createGateChallenge(pass.offerCommitment, 1_800_000_000);
  const proof = await signGateChallenge(pass, challenge);
  const forgedSignature = {
    ...proof,
    signature: `${proof.signature[0] === "A" ? "B" : "A"}${proof.signature.slice(1)}`,
  };
  assert.equal((await verifyGateProof(forgedSignature, challenge, 1_800_000_001)).reason, "bad-signature");
  assert.equal((await verifyGateProof({ ...proof, commitment: "0x123" }, challenge, 1_800_000_001)).reason, "commitment-mismatch");
});
