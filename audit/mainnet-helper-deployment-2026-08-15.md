# Mainnet helper deployment

Checked at: 2026-08-15T10:27:46Z
Network: Starknet mainnet (`SN_MAIN`)

## Release gate

The final pre-deployment release check passed:

- 15 Cairo tests passed, including 500 fuzz runs;
- 12 client and publisher-verifier tests passed;
- typecheck and production build passed;
- production dependency audit reported zero known vulnerabilities;
- Sierra class hash matched the pinned artifact;
- Starknet v0.14.1 Blake and legacy Poseidon compiled class hashes both matched
  the pinned CASM artifact.

## Declaration

| Field | Value |
| --- | --- |
| Transaction | `0x05777e02b1cfe63c6a43f739067dddc70cbc46e70012daeaec1b7eb3b7ff54e9` |
| Block | `13,327,384` |
| Status | `ACCEPTED_ON_L2`, `SUCCEEDED` |
| Sierra class hash | `0x03152fb2ef8342b6e6ad7dd5e15f110afe14b9b15e349c6ff1941871bb0d5495` |
| Mainnet Blake compiled hash | `0x17f455cdec787f9db877a4695d57c47a5a3606670c78b0dacb5545f6b938512` |
| Actual fee | `7.780010479084892544 STRK` |

The dry-run estimate was `7.780010730596769024 STRK`; the submitted ceiling was
`9.725013413245961280 STRK`. The account nonce advanced from `0x3` to `0x4`.

## Deployment

| Field | Value |
| --- | --- |
| Transaction | `0x065e0f62f4abaf5a7ad07e1e7584f113c6da9e6b4a2cbc948afbf01460b68655` |
| Block | `13,327,437` |
| Status | `ACCEPTED_ON_L2`, `SUCCEEDED` |
| Helper | `0x05dd2c68fa1c0fba3b425a7c855fbc0a60867763b2688bf44f2225d422173da6` |
| Class hash at helper | `0x03152fb2ef8342b6e6ad7dd5e15f110afe14b9b15e349c6ff1941871bb0d5495` |
| Salt | `0x5645494c50415353`, unique to the deployer |
| Actual fee | `0.065207243273097120 STRK` |

The helper's `get_pool` view returned the canonical mainnet pool:

```text
0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a
```

The account nonce advanced from `0x4` to `0x5`. The post-deployment balance was
`83.047040180887563984 STRK`. Funding-to-current total spend reconciled exactly
to `17.046589819112436016 STRK`, inside the 100 STRK activation envelope and
the user's 1,000 STRK absolute cap.

