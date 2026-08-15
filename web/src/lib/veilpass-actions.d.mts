type Hexable = string | number | bigint;

export type MembershipActionInput = {
  token: string;
  helper: string;
  creator: string;
  amount: bigint;
  commitment: string;
  offerCommitment: string;
  durationSeconds: number;
  toHex: (value: Hexable) => string;
};

export type StoredPass = {
  secret: string;
  commitment: string;
  offerCommitment: string;
  expiry: number;
  transactionHash: string;
};

export const OPEN_NOTE_PLACEHOLDER: "${openNoteIds[0]}";
export const LAST_PASS_KEY: "veilpass:last-pass";
export const PENDING_PASS_KEY: "veilpass:pending-pass";
export const OFFER_DURATIONS: number[];
export type CreatorOffer = {
  creator: string;
  amount: string;
  days: number;
  nonce: string;
};
export function parseTokenAmount(value: string, decimals?: number): bigint;
export function parseOfferParams(
  search: string,
  normalizeAddress: (value: string) => string,
): CreatorOffer | undefined;
export function buildOfferUrl(input: {
  baseUrl: string;
  creator: string;
  amount: string;
  days: number;
  nonce: string;
}): string;
export function parseStoredPass(value: string | null): StoredPass | undefined;
export function buildMembershipActions(input: MembershipActionInput): unknown[];
