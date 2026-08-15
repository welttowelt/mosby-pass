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
| Contract tests | 12 pass, including 128 fuzz runs |
| Wallet action and recovery tests | 4 pass |
| Static client | Typecheck and production build pass |
| Dependency audit | 0 known vulnerabilities |
| Independent audit checkpoint | No retained P1 or P2 finding |
| Mainnet helper | Not deployed |
| Public demo | [Live on GitHub Pages](https://welttowelt.github.io/veilpass/) |

The repository only calls something complete after it has been checked. Mainnet
addresses and transaction hashes stay empty until they exist.

## The transaction

The privacy wallet prepares one STRK20 transaction with three actions.

1. Withdraw the membership amount from the subscriber's shielded balance to the
   shared Veilpass helper.
2. Create an open note for the creator. The pool knows the note recipient, but
   public observers cannot link that creator to the subscriber's wallet.
3. Invoke the helper. It records the access commitment and expiry, approves the
   exact payment amount back to the pool, and returns the open-note deposit.

The helper calldata ends with `${openNoteIds[0]}`. The wallet replaces that
literal placeholder with the note ID while assembling the transaction.

```text
shielded subscriber balance
  -> shared Veilpass helper
  -> creator's private open note

random local secret
  -> Poseidon commitment on Starknet
  -> fixed membership expiry
```

## Privacy boundary

Public onchain data includes the helper, token, amount, time, expiry, and access
commitment. Open-note amounts are public by design.

The STRK20 transaction hides the link to the subscriber's public wallet and the
creator recipient. The dapp never asks for a viewing key. Ready or Xverse keeps
the private state and prepares the cryptographic proof inside the wallet flow.

The access secret stays in the subscriber's browser. A publisher can hash that
secret, read the commitment expiry, and return protected content from a server.
The demo only verifies entitlement state. Static browser assets are not private.
Veilpass stores a pending pass before asking the wallet to generate a proof. A
refresh can recover the secret and resume transaction confirmation.

## Contract invariants

- Only the configured STRK20 pool can activate an entitlement.
- Token, amount, commitment, and final open-note ID must be non-zero.
- Expiry must be in the future and at most 366 days away.
- Each commitment can be activated once.
- The helper must hold the full payment amount.
- ERC-20 approval is exact and must succeed before membership state is written.
- The returned note ID, token, and amount match the wallet request.

The contract and client checkpoints are in
[audit/report-2026-08-15.md](audit/report-2026-08-15.md) and
[audit/client-report-2026-08-15.md](audit/client-report-2026-08-15.md).

## Run the contract tests

The repository currently uses Cairo and Scarb 2.14.0 with Starknet Foundry
0.55.0.

```bash
scarb build
snforge test
```

## Run the client

The web app follows Wallet API v6 and starknet.js 10.4.0. It supports privacy
wallet discovery, the three-action membership transaction, local pass-secret
generation, and onchain expiry checks.

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

Run the action and recovery tests without installing frontend packages.

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
successful mainnet transactions that touch the STRK20 pool. Those hashes will go
into `strk20.json` after the wallet confirms them.

Deployment and membership transactions spend funds and require an explicit
wallet confirmation. No script in this repository holds a private key.

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
