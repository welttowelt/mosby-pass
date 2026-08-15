# Mainnet declaration preflight

Checked at: 2026-08-15T08:52:12Z
Starknet block: 13,324,024
RPC: `https://rpc.starknet.lava.build`

## Result

The audited Veilpass Sierra class was not declared on Starknet mainnet at the
checked block. `starknet_getClass` returned JSON-RPC error code 28, `Class hash
not found`, for:

```text
0x03152fb2ef8342b6e6ad7dd5e15f110afe14b9b15e349c6ff1941871bb0d5495
```

The deployment path therefore requires both declaration and deployment. Each is
a wallet-controlled transaction with a network fee. Recheck immediately before
signing because another account can declare the same class in the meantime.

## Blake migration recheck

At 2026-08-15T10:21:34Z, a Blake-aware Starknet Foundry 0.60.0 dry run
successfully simulated declaration against mainnet without submitting a
transaction. The account nonce remained `0x3` before and after. The estimate
was `7.780010730596769024 STRK`.

The dry run reproduced:

- Sierra class hash: `0x03152fb2ef8342b6e6ad7dd5e15f110afe14b9b15e349c6ff1941871bb0d5495`
- mainnet Blake compiled class hash: `0x17f455cdec787f9db877a4695d57c47a5a3606670c78b0dacb5545f6b938512`
- legacy Poseidon compiled class hash: `0x002a860c68ea0b96e30f5a4f536ca2c4e394f28abdb42b4822ea8158a44e1658`

Starknet v0.14.1 rejects the legacy Poseidon value for new declarations.

The checked sprint registry commit contained 30 entries and did
not contain `https://github.com/welttowelt/veilpass`. Veilpass was registered
later through `starkience/strk20-hackathon#37`; this paragraph records the
earlier preflight snapshot rather than current registry state.

## Recheck command

```bash
curl --fail --silent --show-error https://rpc.starknet.lava.build \
  -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","method":"starknet_getClass","params":{"block_id":"latest","class_hash":"0x03152fb2ef8342b6e6ad7dd5e15f110afe14b9b15e349c6ff1941871bb0d5495"},"id":1}' \
  | jq .
```
