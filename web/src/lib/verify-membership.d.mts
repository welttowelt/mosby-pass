export type MembershipVerificationReason =
  | "active"
  | "not-found"
  | "offer-mismatch"
  | "duration-mismatch"
  | "expired"
  | "note-not-received";

export type MembershipVerification = {
  valid: boolean;
  reason: MembershipVerificationReason;
  commitment: string;
  startedAt: number;
  expiresAt: number;
  offerCommitment: string;
  noteId: string;
};

export type MembershipProvider = {
  callContract(input: {
    contractAddress: string;
    entrypoint: string;
    calldata: string[];
  }): Promise<readonly string[]>;
};

export function verifyMembership(input: {
  provider: MembershipProvider;
  helper: string;
  secret: string;
  expectedOfferCommitment: string;
  expectedDurationSeconds: number;
  receivedNote: (noteId: string) => boolean | Promise<boolean>;
  nowSeconds?: number;
}): Promise<MembershipVerification>;
