export const OPEN_NOTE_PLACEHOLDER = "${openNoteIds[0]}";
export const LAST_PASS_KEY = "veilpass:last-pass";
export const PENDING_PASS_KEY = "veilpass:pending-pass";

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
  expiry,
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
        toHex(expiry),
        OPEN_NOTE_PLACEHOLDER,
      ],
    },
  ];
}
