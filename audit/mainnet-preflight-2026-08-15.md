# Mainnet declaration preflight

Checked at: 2026-08-15T08:21:59Z
Starknet block: 13,322,937
RPC: `https://rpc.starknet.lava.build`

## Result

The audited Veilpass Sierra class was not declared on Starknet mainnet at the
checked block. `starknet_getClass` returned JSON-RPC error code 28, `Class hash
not found`, for:

```text
0x0259f051e136da4fed7e5f4cbf51aa39a5b79f04c656b761471ada1f805aa174
```

The deployment path therefore requires both declaration and deployment. Each is
a wallet-controlled transaction with a network fee. Recheck immediately before
signing because another account can declare the same class in the meantime.

The live sprint registry contained 29 entries at the same checkpoint and did
not contain `https://github.com/welttowelt/veilpass`. Registration still requires
the user's Telegram username without `@`.

## Recheck command

```bash
curl --fail --silent --show-error https://rpc.starknet.lava.build \
  -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","method":"starknet_getClass","params":{"block_id":"latest","class_hash":"0x0259f051e136da4fed7e5f4cbf51aa39a5b79f04c656b761471ada1f805aa174"},"id":1}' \
  | jq .
```
