export const OPEN_NOTE_PLACEHOLDER = "${openNoteIds[0]}";
export const LAST_PASS_KEY = "veilpass:last-pass";
export const PENDING_PASS_KEY = "veilpass:pending-pass";
export const OFFER_DURATIONS = [7, 30, 90, 365];

export function parseTokenAmount(value, decimals = 18) {
  const normalized = value.trim();
  if (!/^\d+(\.\d+)?$/.test(normalized)) throw new Error("Enter a positive decimal amount.");
  const [whole, fraction = ""] = normalized.split(".");
  if (fraction.length > decimals) throw new Error(`Use no more than ${decimals} decimal places.`);
  const amount = BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, "0"));
  if (amount <= 0n) throw new Error("Amount must be greater than zero.");
  if (amount >= 2n ** 128n) throw new Error("Amount exceeds the helper limit.");
  return amount;
}

export function parseOfferParams(search, normalizeAddress) {
  try {
    const params = new URLSearchParams(search);
    const creatorValue = params.get("creator");
    const amountValue = params.get("amount")?.trim();
    const daysValue = Number(params.get("days"));
    const nonceValue = params.get("offer");
    if (!creatorValue || !amountValue || !nonceValue) return undefined;
    if (!/^0x[0-9a-f]+$/i.test(nonceValue) || BigInt(nonceValue) === 0n) return undefined;
    if (!OFFER_DURATIONS.includes(daysValue)) return undefined;
    parseTokenAmount(amountValue);
    return {
      creator: normalizeAddress(creatorValue),
      amount: amountValue,
      days: daysValue,
      nonce: nonceValue.toLowerCase(),
    };
  } catch {
    return undefined;
  }
}

export function buildOfferUrl({ baseUrl, creator, amount, days, nonce }) {
  parseTokenAmount(amount);
  if (!OFFER_DURATIONS.includes(days)) throw new Error("Choose a supported access term.");
  if (!/^0x[0-9a-f]+$/i.test(nonce) || BigInt(nonce) === 0n) {
    throw new Error("Offer nonce must be a non-zero felt.");
  }
  const url = new URL(baseUrl);
  url.search = "";
  url.hash = "";
  url.searchParams.set("creator", creator);
  url.searchParams.set("amount", amount.trim());
  url.searchParams.set("days", String(days));
  url.searchParams.set("offer", nonce.toLowerCase());
  return url.toString();
}

export function parseStoredPass(value) {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value);
    const felt = /^0x[0-9a-f]+$/i;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof parsed.secret !== "string" ||
      !felt.test(parsed.secret) ||
      typeof parsed.commitment !== "string" ||
      !felt.test(parsed.commitment) ||
      typeof parsed.offerCommitment !== "string" ||
      !felt.test(parsed.offerCommitment) ||
      !Number.isSafeInteger(parsed.expiry) ||
      parsed.expiry <= 0 ||
      typeof parsed.transactionHash !== "string" ||
      (parsed.transactionHash !== "" && !felt.test(parsed.transactionHash))
    ) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

export function buildMembershipActions({
  token,
  helper,
  creator,
  amount,
  commitment,
  offerCommitment,
  durationSeconds,
  toHex,
}) {
  return [
    { type: "withdraw", token, amount: toHex(amount), recipient: helper },
    { type: "transfer", token, amount: "OPEN", recipient: creator },
    {
      type: "invoke",
      contract: helper,
      calldata: [
        toHex(token),
        toHex(amount),
        toHex(commitment),
        toHex(durationSeconds),
        toHex(offerCommitment),
        OPEN_NOTE_PLACEHOLDER,
      ],
    },
  ];
}
