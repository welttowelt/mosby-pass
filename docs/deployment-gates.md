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

## Gate 2. Contract declaration and deployment

Reserved wallet actions:

1. Declare the verified Veilpass class on mainnet, unless its class hash already
   exists.
2. Deploy one instance with the configured STRK20 pool as its constructor input.
3. Confirm the deployed pool getter returns the expected address.
4. Record the declaration hash, deployment hash, class hash, and helper address.

The audited build resolves to Sierra class hash
`0x0259f051e136da4fed7e5f4cbf51aa39a5b79f04c656b761471ada1f805aa174`
and compiled class hash
`0x068af6a1c2b76f9152195946a118d63da82d1592c3aa441d406c253bd2b2aff6`.
Confirm both values again immediately before signing.

With a user-selected Starknet Foundry account name, the exact mainnet sequence
is:

```bash
sncast --profile mainnet --account <ACCOUNT_NAME> --wait --json \
  declare --contract-name Veilpass --network mainnet

sncast --profile mainnet --account <ACCOUNT_NAME> --wait --json \
  deploy --class-hash \
  0x0259f051e136da4fed7e5f4cbf51aa39a5b79f04c656b761471ada1f805aa174 \
  --constructor-calldata \
  0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a \
  --network mainnet

sncast call --network mainnet --contract-address <DEPLOYED_HELPER> \
  --function get_pool
```

The first two commands submit transactions and may spend STRK on fees. They are
never run without the user's account choice and explicit wallet authorization.

## Gate 3. Client configuration

- Write the deployed helper to `config/mainnet.json` and `strk20.json`.
- Set `NEXT_PUBLIC_VEILPASS_HELPER` for the static build.
- Confirm Ready or Xverse detects Wallet API v6 on mainnet.

## Gate 4. Eligibility transactions

Use small amounts. Each transaction must succeed and include a STRK20 pool event.

1. Create one private membership.
2. Create a second membership with a different secret and duration.
3. Create a third membership or a separate shielded transfer that exercises the
   live product flow.

Record only verified hashes in `strk20.json`. The user's wallet confirms every
transaction and pays any token amount or network fee.

## Gate 5. Public entry

- Publish the static demo.
- Record the demo URL and three-minute video URL.
- Verify the repository is public, licensed, non-empty, and reproducible.
- Add the repository URL plus the user's Telegram handle to the sprint registry.
