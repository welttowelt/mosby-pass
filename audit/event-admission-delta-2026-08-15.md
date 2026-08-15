# Mosby Pass event-admission delta review

Date: 2026-08-15

Scope: event offer encoding, P-256 admission credential, gate challenge and
signature verification, browser UI, and the unchanged deployed helper boundary.

## Retained findings

### MP-01 · Browser key is exportable

Severity: medium for production, accepted for the sprint MVP.

The private admission key is stored as an exportable JWK in local browser state
so a pending transaction survives refresh. Same-origin injected JavaScript can
copy it. The UI and README describe the pass as device-bound, not hardware-
backed. Production mitigation is a wallet-held, secure-enclave, or non-exportable
key with an explicit recovery design.

### MP-02 · One-time consumption is local to one gate

Severity: medium for multi-gate events, accepted for the single-gate MVP.

Consumption is keyed by event and access commitment in gate local storage. It
blocks immediate replay on that browser profile but does not synchronize two
entrances. The UI states this limit. Production mitigation is an organizer-
operated private spent-set service or another design that does not publish
check-in timing.

### MP-03 · Static gate cannot confirm private recipient

Severity: low in the demo, integration requirement for production.

The deployed helper proves that the STRK20 pool supplied an open-note ID and
that the payment activation was atomic. A public client cannot verify which
private wallet received the note. The existing reusable verifier therefore
retains a mandatory organizer-side `receivedNote` callback. The demo does not
claim access to the organizer viewing context.

## Closed cases

- Copied QR or public-key payload: fresh challenge requires the private key.
- Challenge substitution: exact challenge object comparison rejects it.
- Challenge replay: five-minute age gate rejects stale challenges.
- Signature forgery: WebCrypto ECDSA verification rejects modified signatures.
- Public-key substitution: derived commitment must match the paid commitment.
- Event substitution: gate and onchain event commitments must match.
- Early or late admission: event and helper expiry checks reject it.
- Same-gate pass replay: local spent key rejects a second admission.

## Verification

- Client suite covers offer round trips, malformed state, key generation,
  valid proof, changed challenge, stale challenge, forged signature,
  substituted commitment, atomic action shape, and recovery parsing.
- Existing organizer verifier tests cover offer mismatch, duration mismatch,
  expiry, missing records, and private note receipt.
- The unchanged Cairo suite covers pool-only activation, duplicate access and
  note IDs, bounds, balances, approvals, and state-write ordering.
