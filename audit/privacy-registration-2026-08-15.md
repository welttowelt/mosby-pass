# Mainnet privacy registration

Checked at: 2026-08-15T09:58:26Z
Network: Starknet mainnet (`SN_MAIN`)

## Account

```text
0x05995985f99f4295453de696898a12ffca143cd42a6d8971f1a3b0b22e2e48bd
```

The OpenZeppelin account was created from a locally encrypted keystore. The
keystore private key and private viewing key were never written to this
repository or transmitted to the privacy services.

## Transactions

| Action | Transaction | Block | Actual network fee |
|---|---|---:|---:|
| Deploy account | `0x02955210a092ce977d8a1a88dcae80caac281547da251da18a7684596ef4803e` | 13,325,895 | 0.085706334295392880 STRK |
| Approve pool fee | `0x10e7db626809f3e21e552589f609b9192c9b14e10138c7da3d9d75f5071d1f6` | 13,326,305 | 0.060069214355840224 STRK |
| Register viewing key | `0x12bad0ed32d90bbde43d0579624e1bae3585ce1a7f6d4081a7296f099fe1103` | 13,326,369 | 3.055596548103213248 STRK |

Registration also paid the pool's 6 STRK protocol fee. The registration
transaction emitted `ViewingKeySet` from the canonical mainnet pool for the
execution account and public viewing key:

```text
0x6824171fe196ff6a83df1214d554f48d6c3eac4ce9726cccc47d8d91df1f0b5
```

The pool's `get_public_key` view returned the same value after acceptance on
L2. The 100.093630000000000000 STRK funding amount reconciles exactly to the
90.892257903245553648 STRK remaining balance after all three network fees and
the protocol fee. Total spend was 9.201372096754446352 STRK.

Registration is the first qualifying pool-event transaction recorded in
`strk20.json`. Two additional successful pool transactions are still required
for sprint mainnet eligibility.
