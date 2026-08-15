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

The checked sprint registry commit contained 30 entries and did
not contain `https://github.com/welttowelt/veilpass`. Registration still requires
the user's Telegram username without `@`.

## Recheck command

```bash
curl --fail --silent --show-error https://rpc.starknet.lava.build \
  -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","method":"starknet_getClass","params":{"block_id":"latest","class_hash":"0x03152fb2ef8342b6e6ad7dd5e15f110afe14b9b15e349c6ff1941871bb0d5495"},"id":1}' \
  | jq .
```
