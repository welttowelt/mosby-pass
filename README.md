# Veilpass

Private creator memberships on Starknet.

A subscriber pays from a shielded STRK balance. The creator receives a private
open note. The shared helper records a fixed-term access commitment, without
receiving the subscriber's public wallet or viewing key.

Veilpass is a prepaid membership MVP for the STRK20 Private Sprint. It does not
pretend recurring private billing exists before it does.

## Current build

| Component | Status |
| --- | --- |
| Cairo helper | Builds locally |
| Contract tests | 15 pass, including 500 fuzz runs |
| Client and publisher verifier tests | 12 pass |
| Static client | Typecheck and production build pass |
| Dependency audit | 0 known vulnerabilities |
| Security checkpoint | No retained high-severity finding in the current delta review |
| Mainnet helper | [Deployed](https://voyager.online/contract/0x05dd2c68fa1c0fba3b425a7c855fbc0a60867763b2688bf44f2225d422173da6) |
| Public demo | [Live on GitHub Pages](https://welttowelt.github.io/veilpass/) |

The repository only calls something complete after it has been checked. Mainnet
addresses and transaction hashes stay empty until they exist.

## The transaction

The creator first chooses a registered privacy address, amount, and access term.
Veilpass generates a private offer link with a random nonce. The subscriber
client commits to those terms as
`Poseidon(creator, amount, duration_days, offer_nonce)`.

The privacy wallet then prepares one STRK20 transaction with three actions.

1. Withdraw the membership amount from the subscriber's shielded balance to the
   shared Veilpass helper.
2. Create an open note for the creator. The pool knows the note recipient, but
   public observers cannot link that creator to the subscriber's wallet.
3. Invoke the helper. It records the access and offer commitments, activation
   time, expiry, and note ID, approves the exact payment amount back to the
   pool, and returns the open-note deposit.

The helper calldata ends with `${openNoteIds[0]}`. The wallet replaces that
literal placeholder with the note ID while assembling the transaction.

```text
shielded subscriber balance
  -> shared Veilpass helper
  -> creator's private open note

random local secret
  -> Poseidon commitment on Starknet
  -> fixed membership expiry

private creator offer
  -> Poseidon(creator, amount, term, nonce)
  -> exact publisher-side offer check
```

## Privacy boundary

Public onchain data includes the helper, token, amount, time, expiry, and access
commitment. Open-note amounts are public by design.

The STRK20 transaction hides the link to the subscriber's public wallet and the
creator recipient. The dapp never asks for a viewing key. Ready or Xverse keeps
the private state and prepares the cryptographic proof inside the wallet flow.

The access secret stays in the subscriber's browser. A publisher hashes that
secret and verifies the recorded offer, exact start-to-expiry duration, active
expiry, and creator-received note before returning protected content. The
reusable verifier lives in
[`web/src/lib/verify-membership.mjs`](web/src/lib/verify-membership.mjs).

The creator-side note check uses the creator wallet's private viewing context.
Veilpass never receives that viewing key. The demo only reads public entitlement
state. Static browser assets are not private.
Veilpass stores a pending pass before asking the wallet to generate a proof. A
refresh can recover the secret and resume transaction confirmation.

Creator offer links must travel through a private channel. If a link leaks, its
nonce lets an observer recompute and correlate that offer commitment. See the
[offer protocol](docs/offer-protocol.md) for the enforcement and privacy model.

## Contract invariants

- Only the configured STRK20 pool can activate an entitlement.
- Token, amount, access commitment, offer commitment, and final open-note ID
  must be non-zero.
- Expiry must be in the future and at most 366 days away.
- Each access commitment and open-note ID can be activated once.
- The helper must hold the full payment amount.
- ERC-20 approval is exact and must succeed before membership state is written.
- Activation time, expiry, offer commitment, and note ID are written only after
  approval succeeds.
- The returned note ID, token, and amount match the wallet request.

The contract and client checkpoints are in
[audit/report-2026-08-15.md](audit/report-2026-08-15.md) and
[audit/client-report-2026-08-15.md](audit/client-report-2026-08-15.md). The
[score-gap checkpoint](audit/score-gap-2026-08-15.md) tracks the distance from
the full recurring-subscription RFP and final hackathon eligibility.

## Run the contract tests

The repository currently uses Cairo and Scarb 2.14.0 with Starknet Foundry
0.55.0.

```bash
scarb build
snforge test
```

## Run the client

The web app follows Wallet API v6 and starknet.js 10.4.0. It supports privacy
wallet discovery, creator offer links, the three-action membership transaction,
local pass-secret generation, onchain entitlement checks, and a reusable
publisher verifier.

```bash
cd web
npm install
cp .env.example .env.local
npm run dev
```

Set these values in `.env.local`.

```text
NEXT_PUBLIC_STARKNET_RPC_URL=<mainnet RPC URL>
NEXT_PUBLIC_VEILPASS_HELPER=<deployed helper address>
```

Run the client and publisher-verifier tests.

```bash
cd web
node --test tests/*.test.mjs
```

Before declaration, reproduce every source hash, contract artifact, test, and
production client build in one pass.

```bash
./scripts/verify-release.sh
```

## Mainnet gate

The sprint requires a public demo, a three-minute video, and at least three
successful mainnet transactions that touch the STRK20 pool. The execution
account is registered and the audited helper is live. One qualifying pool
transaction is recorded in `strk20.json`; two product-flow transactions and the
video remain.

Membership transactions spend funds and require bounded execution authority.
No script in this repository holds a private key.

## Built from public interfaces

- [STRK20 Private Sprint](https://strk20.starknet.io/hackathon)
- [Starknet.js WalletAccountV6 guide](https://starknet-js.com/docs/next/guides/account/walletAccount/#with-get-starknet-v6)
- [STRK20 starter kit](https://github.com/Akashneelesh/strk20-starter-kit)
- [Starknet privacy contracts and SDK](https://github.com/starkware-libs/starknet-privacy)

The wallet discovery and package-version choices follow the MIT-licensed starter
kit. Veilpass replaces its echo demo with a tested membership helper and access
commitment flow.

## License

MIT
