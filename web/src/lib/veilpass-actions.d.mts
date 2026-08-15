type Hexable = string | number | bigint;

export type MembershipActionInput = {
  token: string;
  helper: string;
  creator: string;
  amount: bigint;
  commitment: string;
  expiry: number;
  toHex: (value: Hexable) => string;
};

export type StoredPass = {
  secret: string;
  commitment: string;
  expiry: number;
  transactionHash: string;
};

export const OPEN_NOTE_PLACEHOLDER: "${openNoteIds[0]}";
export const LAST_PASS_KEY: "veilpass:last-pass";
export const PENDING_PASS_KEY: "veilpass:pending-pass";
export function parseStoredPass(value: string | null): StoredPass | undefined;
export function buildMembershipActions(input: MembershipActionInput): unknown[];
