import { hash, num } from "starknet";

export const EVENT_SCHEMA = "veilpass:event:v1";
export const GATE_SCHEMA = "veilpass:gate:v1";
export const PROOF_SCHEMA = "veilpass:admission:v1";
export const MAX_GATE_CHALLENGE_AGE_SECONDS = 5 * 60;

const feltPattern = /^0x[0-9a-f]+$/i;

function randomHex(bytes = 30) {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  if (value.every((byte) => byte === 0)) value[0] = 1;
  return `0x${Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function base64UrlToBytes(value) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function bytesToBigInt(bytes) {
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return BigInt(`0x${hex || "0"}`);
}

function publicKeyFelt(publicKey) {
  if (!publicKey || publicKey.kty !== "EC" || publicKey.crv !== "P-256" || !publicKey.x || !publicKey.y) {
    throw new Error("Pass public key must be an exportable P-256 key.");
  }
  const x = bytesToBigInt(base64UrlToBytes(publicKey.x));
  const y = bytesToBigInt(base64UrlToBytes(publicKey.y));
  const mask = (1n << 128n) - 1n;
  return num.toHex(hash.computePoseidonHashOnElements([x & mask, x >> 128n, y & mask, y >> 128n]));
}

export function eventOfferCommitment(offer) {
  const startsAt = Number(offer.startsAt);
  const closesAt = Number(offer.closesAt);
  if (!Number.isSafeInteger(startsAt) || !Number.isSafeInteger(closesAt) || closesAt <= startsAt) {
    throw new Error("Event close time must follow its start time.");
  }
  return num.toHex(hash.computePoseidonHashOnElements([
    offer.organizer,
    offer.amount,
    hash.starknetKeccak(offer.title.trim()),
    hash.starknetKeccak(offer.venue.trim()),
    startsAt,
    closesAt,
    offer.nonce,
  ]));
}

export function buildEventOfferUrl({ baseUrl, organizer, amount, title, venue, startsAt, closesAt, nonce }) {
  if (!feltPattern.test(nonce) || BigInt(nonce) === 0n) throw new Error("Event nonce must be a non-zero felt.");
  if (!title.trim() || !venue.trim()) throw new Error("Add an event name and venue.");
  const url = new URL(baseUrl);
  url.search = "";
  url.hash = "";
  url.searchParams.set("event", title.trim());
  url.searchParams.set("venue", venue.trim());
  url.searchParams.set("organizer", organizer);
  url.searchParams.set("amount", amount.trim());
  url.searchParams.set("starts", String(startsAt));
  url.searchParams.set("closes", String(closesAt));
  url.searchParams.set("offer", nonce.toLowerCase());
  return url.toString();
}

export function parseEventOffer(search, normalizeAddress, parseAmount) {
  try {
    const params = new URLSearchParams(search);
    const offer = {
      title: params.get("event")?.trim(),
      venue: params.get("venue")?.trim(),
      organizer: normalizeAddress(params.get("organizer")),
      amountText: params.get("amount")?.trim(),
      startsAt: Number(params.get("starts")),
      closesAt: Number(params.get("closes")),
      nonce: params.get("offer")?.toLowerCase(),
    };
    if (!offer.title || !offer.venue || !offer.amountText || !feltPattern.test(offer.nonce ?? "")) return undefined;
    if (BigInt(offer.nonce) === 0n || !Number.isSafeInteger(offer.startsAt) || !Number.isSafeInteger(offer.closesAt)) return undefined;
    const amount = parseAmount(offer.amountText);
    if (offer.closesAt <= offer.startsAt) return undefined;
    return { ...offer, amount, commitment: eventOfferCommitment({ ...offer, amount }) };
  } catch {
    return undefined;
  }
}

export async function generateAdmissionCredential() {
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const [publicKey, privateKey] = await Promise.all([
    crypto.subtle.exportKey("jwk", keyPair.publicKey),
    crypto.subtle.exportKey("jwk", keyPair.privateKey),
  ]);
  const keyFelt = publicKeyFelt(publicKey);
  return {
    publicKey,
    privateKey,
    keyFelt,
    commitment: num.toHex(hash.computePoseidonHashOnElements([keyFelt])),
  };
}

export function createGateChallenge(offerCommitment, issuedAt = Math.floor(Date.now() / 1000)) {
  if (!feltPattern.test(offerCommitment)) throw new Error("Load a valid event before opening the gate.");
  return { schema: GATE_SCHEMA, offerCommitment: num.toHex(offerCommitment), nonce: randomHex(16), issuedAt };
}

function challengeMessage(challenge) {
  return `${challenge.schema}|${challenge.offerCommitment}|${challenge.nonce}|${challenge.issuedAt}`;
}

export async function signGateChallenge(pass, challenge) {
  if (!pass?.privateKey || !pass?.publicKey || !pass?.commitment) throw new Error("This browser does not hold an admission key.");
  if (challenge.offerCommitment !== pass.offerCommitment) throw new Error("This gate challenge belongs to a different event.");
  const key = await crypto.subtle.importKey(
    "jwk",
    pass.privateKey,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(challengeMessage(challenge)),
  );
  return {
    schema: PROOF_SCHEMA,
    challenge,
    publicKey: pass.publicKey,
    commitment: pass.commitment,
    signature: bytesToBase64Url(new Uint8Array(signature)),
  };
}

export async function verifyGateProof(proof, expectedChallenge, nowSeconds = Math.floor(Date.now() / 1000)) {
  try {
    if (proof?.schema !== PROOF_SCHEMA || proof.challenge?.schema !== GATE_SCHEMA) return { valid: false, reason: "malformed-proof" };
    if (JSON.stringify(proof.challenge) !== JSON.stringify(expectedChallenge)) return { valid: false, reason: "challenge-mismatch" };
    if (nowSeconds < proof.challenge.issuedAt || nowSeconds - proof.challenge.issuedAt > MAX_GATE_CHALLENGE_AGE_SECONDS) {
      return { valid: false, reason: "stale-challenge" };
    }
    const keyFelt = publicKeyFelt(proof.publicKey);
    const commitment = num.toHex(hash.computePoseidonHashOnElements([keyFelt]));
    if (commitment !== num.toHex(proof.commitment)) return { valid: false, reason: "commitment-mismatch" };
    const key = await crypto.subtle.importKey(
      "jwk",
      proof.publicKey,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    const signatureValid = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      base64UrlToBytes(proof.signature),
      new TextEncoder().encode(challengeMessage(proof.challenge)),
    );
    return signatureValid
      ? { valid: true, reason: "signature-valid", commitment }
      : { valid: false, reason: "bad-signature", commitment };
  } catch {
    return { valid: false, reason: "malformed-proof" };
  }
}
