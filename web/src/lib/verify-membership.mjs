import { hash, num } from "starknet";

const FELT_LIMIT = 2n ** 252n;

function requireFelt(value, label) {
  if (typeof value !== "string" || !/^0x[0-9a-f]+$/i.test(value)) {
    throw new Error(`${label} must be a hexadecimal felt.`);
  }
  const parsed = BigInt(value);
  if (parsed <= 0n || parsed >= FELT_LIMIT) {
    throw new Error(`${label} must be a non-zero felt.`);
  }
  return num.toHex(parsed);
}

function readFelt(result) {
  return num.toBigInt(result?.[0] ?? "0x0");
}

/**
 * Verify a Veilpass bearer secret against a creator's private offer record.
 * `receivedNote` must use the creator wallet's private viewing context to confirm
 * that the returned note id carries the expected token and amount.
 */
export async function verifyMembership({
  provider,
  helper,
  secret,
  expectedOfferCommitment,
  expectedDurationSeconds,
  receivedNote,
  nowSeconds = Math.floor(Date.now() / 1000),
}) {
  if (!provider || typeof provider.callContract !== "function") {
    throw new Error("provider must expose callContract.");
  }
  const helperAddress = requireFelt(helper, "helper");
  const passSecret = requireFelt(secret, "secret");
  const expectedOffer = requireFelt(expectedOfferCommitment, "expectedOfferCommitment");
  if (!Number.isSafeInteger(expectedDurationSeconds) || expectedDurationSeconds <= 0) {
    throw new Error("expectedDurationSeconds must be a positive safe integer.");
  }
  if (!Number.isSafeInteger(nowSeconds) || nowSeconds < 0) {
    throw new Error("nowSeconds must be a non-negative safe integer.");
  }
  if (typeof receivedNote !== "function") {
    throw new Error("A receivedNote callback is required for publisher verification.");
  }

  const commitment = num.toHex(hash.computePoseidonHashOnElements([passSecret]));
  const call = (entrypoint) => provider.callContract({
    contractAddress: helperAddress,
    entrypoint,
    calldata: [commitment],
  });
  const [startedResult, expiryResult, offerResult, noteResult] = await Promise.all([
    call("get_started"),
    call("get_expiry"),
    call("get_offer"),
    call("get_note"),
  ]);

  const startedAtBig = readFelt(startedResult);
  const expiresAtBig = readFelt(expiryResult);
  const offerBig = readFelt(offerResult);
  const noteBig = readFelt(noteResult);
  const base = {
    commitment,
    startedAt: Number(startedAtBig),
    expiresAt: Number(expiresAtBig),
    offerCommitment: num.toHex(offerBig),
    noteId: num.toHex(noteBig),
  };

  if (startedAtBig === 0n || expiresAtBig === 0n || offerBig === 0n || noteBig === 0n) {
    return { valid: false, reason: "not-found", ...base };
  }
  if (offerBig !== BigInt(expectedOffer)) {
    return { valid: false, reason: "offer-mismatch", ...base };
  }
  if (expiresAtBig !== startedAtBig + BigInt(expectedDurationSeconds)) {
    return { valid: false, reason: "duration-mismatch", ...base };
  }
  if (expiresAtBig <= BigInt(nowSeconds)) {
    return { valid: false, reason: "expired", ...base };
  }
  if (!(await receivedNote(num.toHex(noteBig)))) {
    return { valid: false, reason: "note-not-received", ...base };
  }
  return { valid: true, reason: "active", ...base };
}
