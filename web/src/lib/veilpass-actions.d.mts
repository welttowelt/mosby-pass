type Hexable = string | number | bigint;

export type AdmissionActionInput = {
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
  publicKey: JsonWebKey;
  privateKey: JsonWebKey;
  keyFelt: string;
  commitment: string;
  offerCommitment: string;
  eventTitle: string;
  venue: string;
  startsAt: number;
  closesAt: number;
  transactionHash: string;
};

export const OPEN_NOTE_PLACEHOLDER: "${openNoteIds[0]}";
export const LAST_PASS_KEY: "veilpass:last-pass";
export const PENDING_PASS_KEY: "veilpass:pending-pass";
export function parseTokenAmount(value: string, decimals?: number): bigint;
export function parseStoredPass(value: string | null): StoredPass | undefined;
export function buildAdmissionActions(input: AdmissionActionInput): unknown[];
export const buildMembershipActions: typeof buildAdmissionActions;
