# Mosby Pass

Private event admission on Starknet.

An attendee scans an event QR, pays from shielded STRK, and receives a
device-bound pass. At the door, a fresh challenge proves control of that pass
without exposing the attendee's public wallet to the organizer.

> Scan. Pay privately. Walk in.

## Current build

| Component | Status |
| --- | --- |
| Mainnet payment helper | [Deployed](https://voyager.online/contract/0x05dd2c68fa1c0fba3b425a7c855fbc0a60867763b2688bf44f2225d422173da6) |
| Cairo tests | 15 pass, including 500 fuzz runs |
| Client and verifier tests | 13 pass |
| Static client | Typecheck and production build pass |
| Dependency audit | 0 known vulnerabilities |
| Public demo | [GitHub Pages](https://welttowelt.github.io/mosby-pass/) |

The product was renamed from Veilpass to Mosby Pass. The already-deployed Cairo
class and compatibility storage keys retain their original technical names;
renaming an immutable mainnet ABI would require a new deployment without adding
privacy or admission guarantees.

## The flow

### 1. Organizer

The organizer chooses an event name, venue, registered privacy address, STRK
price, and admission window. Mosby Pass produces a QR-backed event link with a
random nonce and commits to all of those terms.

```text
event_commitment = Poseidon(
  organizer,
  amount,
  StarknetKeccak(event_name),
  StarknetKeccak(venue),
  opens_at,
  closes_at,
  nonce
)
```

### 2. Attendee

The browser generates an ephemeral P-256 signing key and derives the access
commitment from its public key. Ready or Xverse then prepares one STRK20
transaction:

1. withdraw the amount from the attendee's shielded balance to the shared
   helper;
2. create a private open note for the organizer;
3. call the helper through the STRK20 pool, binding the payment note, event
   commitment, access commitment, activation time, and expiry atomically.

The helper never receives the attendee wallet, organizer address, viewing key,
event name, or venue.

### 3. Gate

The gate issues a random challenge valid for five minutes. The attendee device
signs it with the admission key. The scanner verifies:

- the exact challenge and event commitment;
- the P-256 signature and its derived access commitment;
- the recorded mainnet payment, open-note ID, and active expiry;
- the event's opening and closing time;
- local one-time consumption on the gate device.

A copied screenshot or static bearer code cannot answer a fresh challenge.

## Privacy boundary

Hidden by STRK20:

- attendee public wallet;
- attendee private balance;
- the public-wallet-to-organizer payment link.

Public on Starknet:

- helper and token addresses;
- amount and timing;
- opaque access and event commitments;
- activation, expiry, and open-note identifier.

Mosby Pass does not hide a face at the venue, IP address, device fingerprint,
amount, or timing. The current browser credential is not hardware-backed.
One-time consumption is local to one gate device; multiple synchronized gates
need an organizer-operated private service. The organizer should additionally
confirm the received note from its private wallet context before admitting.

## Contract invariants

- Only the configured STRK20 pool can activate a pass.
- Token, amount, access commitment, event commitment, and open-note ID must be
  non-zero.
- Expiry must be in the future and no more than 366 days away.
- Each access commitment and open-note ID can be activated once.
- The helper must hold the full payment amount.
- ERC-20 approval is exact and must succeed before admission state is written.
- The returned note ID, token, and amount match the wallet request.

The deployed class is unchanged by the product pivot. Existing contract audit
evidence remains in [`audit/`](audit/); the event-admission delta is covered by
the browser credential tests and the pivot checkpoint.

## Run locally

The pinned toolchain is Scarb 2.14.0, Starknet Foundry 0.55.0, Next.js 16.3.1,
and starknet.js 10.4.0.

```bash
scarb build
snforge test

cd web
npm install
cp .env.example .env.local
npm run typecheck
npm run test:actions
npm run dev
```

Set these client values in `.env.local`:

```text
NEXT_PUBLIC_STARKNET_RPC_URL=<mainnet RPC URL>
NEXT_PUBLIC_VEILPASS_HELPER=<deployed compatibility helper address>
```

Run the deterministic release gate from the repository root:

```bash
./scripts/verify-release.sh
```

## Sprint status

The execution account is registered with the STRK20 privacy pool and the helper
is deployed. One qualifying pool transaction is recorded in `strk20.json`; two
event-flow transactions and the public demo video remain before final sprint
submission.

Transactions spend STRK and require bounded execution authority. No repository
script contains a private key.

## Sources and design reference

- [STRK20 Private Sprint](https://strk20.starknet.io/hackathon)
- [STRK20 privacy contracts and SDK](https://github.com/starkware-libs/starknet-privacy)
- [Starknet.js Wallet API v6 guide](https://starknet-js.com/docs/next/guides/account/walletAccount/#with-get-starknet-v6)
- [Mosby's Files](https://www.mosbyfiles.com/) by Tubik — visual reference for
  the file-stack navigation; Mosby Pass is not affiliated with that project.

## License

MIT
