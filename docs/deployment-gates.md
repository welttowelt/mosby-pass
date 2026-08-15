# Deployment gates

This file separates checked configuration from wallet-controlled actions.

## Checked mainnet configuration

- Chain: `SN_MAIN`
- Pool: `0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a`
- STRK: `0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d`

At Starknet block 13,321,905, `starknet_getClassHashAt` returned
`0x67dddd89d80fedadc06b6f160798f94800a4a70164e5a24301cd0d6076b554d`
for the configured pool. Deployment automation must read `config/mainnet.json`
instead of copying addresses from prose.

## Gate 1. Reproducible build

- Install the repository-pinned Cairo toolchain.
- Run `scarb build` and `snforge test`.
- Install the pinned web dependencies and create `package-lock.json`.
- Run `npm run typecheck`, `npm run test:actions`, and `npm run build`.

## Gate 2. Contract declaration and deployment — complete

Completed wallet actions:

1. Declare the verified legacy `Veilpass` class on mainnet, unless its class hash already
   exists.
2. Deploy one instance with the configured STRK20 pool as its constructor input.
3. Confirm the deployed pool getter returns the expected address.
4. Record the declaration hash, deployment hash, class hash, and helper address.

The audited build resolves to Sierra class hash
`0x03152fb2ef8342b6e6ad7dd5e15f110afe14b9b15e349c6ff1941871bb0d5495`
and Starknet v0.14.1 mainnet Blake compiled class hash
`0x17f455cdec787f9db877a4695d57c47a5a3606670c78b0dacb5545f6b938512`.
The same CASM artifact has legacy Poseidon hash
`0x002a860c68ea0b96e30f5a4f536ca2c4e394f28abdb42b4822ea8158a44e1658`;
that legacy value must not be supplied as the mainnet compiled class hash.
Confirm all three values again immediately before signing.

The equivalent Starknet Foundry sequence is:

```bash
sncast --profile mainnet --account <ACCOUNT_NAME> --wait --json \
  declare --contract-name Veilpass --network mainnet

sncast --profile mainnet --account <ACCOUNT_NAME> --wait --json \
  deploy --class-hash \
  0x03152fb2ef8342b6e6ad7dd5e15f110afe14b9b15e349c6ff1941871bb0d5495 \
  --constructor-calldata \
  0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a \
  --network mainnet

sncast call --network mainnet --contract-address <DEPLOYED_HELPER> \
  --function get_pool
```

The first two commands submit transactions and may spend STRK on fees. Mosby Pass
completed them under the campaign's bounded execution authority; receipt and
post-state evidence is in
[`audit/mainnet-helper-deployment-2026-08-15.md`](../audit/mainnet-helper-deployment-2026-08-15.md).

## Gate 3. Client configuration

- Write the deployed helper to `config/mainnet.json` and `strk20.json`.
- Set `NEXT_PUBLIC_VEILPASS_HELPER` for the static build.
- Confirm Ready or Xverse detects Wallet API v6 on mainnet.

## Gate 4. Eligibility transactions

Use small amounts. Each transaction must succeed and include a STRK20 pool event.

1. Activate one private event pass.
2. Activate a second pass with a different device key and event commitment.
3. Activate a third pass or a separate shielded transfer that exercises the
   live product flow.

Record only verified hashes in `strk20.json`. The user's wallet confirms every
transaction and pays any token amount or network fee.

## Gate 5. Public entry

- Publish the static demo.
- Record the demo URL and three-minute video URL.
- Verify the repository is public, licensed, non-empty, and reproducible.
- Add the repository URL plus the user's Telegram handle to the sprint registry.
