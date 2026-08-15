export type EventOffer = {
  title: string;
  venue: string;
  organizer: string;
  amountText: string;
  amount: bigint;
  startsAt: number;
  closesAt: number;
  nonce: string;
  commitment: string;
};

export type GateChallenge = {
  schema: "veilpass:gate:v1";
  offerCommitment: string;
  nonce: string;
  issuedAt: number;
};

export type AdmissionPass = {
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

export const EVENT_SCHEMA: "veilpass:event:v1";
export const GATE_SCHEMA: "veilpass:gate:v1";
export const PROOF_SCHEMA: "veilpass:admission:v1";
export const MAX_GATE_CHALLENGE_AGE_SECONDS: number;
export function eventOfferCommitment(offer: Record<string, unknown>): string;
export function buildEventOfferUrl(input: Record<string, string | number>): string;
export function parseEventOffer(
  search: string,
  normalizeAddress: (value: string | null) => string,
  parseAmount: (value: string) => bigint,
): EventOffer | undefined;
export function generateAdmissionCredential(): Promise<{
  publicKey: JsonWebKey;
  privateKey: JsonWebKey;
  keyFelt: string;
  commitment: string;
}>;
export function createGateChallenge(offerCommitment: string, issuedAt?: number): GateChallenge;
export function signGateChallenge(pass: AdmissionPass, challenge: GateChallenge): Promise<Record<string, unknown>>;
export function verifyGateProof(
  proof: Record<string, unknown>,
  expectedChallenge: GateChallenge,
  nowSeconds?: number,
): Promise<{ valid: boolean; reason: string; commitment?: string }>;
