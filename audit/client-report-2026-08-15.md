# Veilpass client audit checkpoint

Date: 2026-08-15
Scope: `web/src`, `web/tests`, `web/package.json`, `web/package-lock.json`
Runtime: Node.js 24, npm 11.8.0, Next.js 16.3.1, starknet.js 10.4.0

## Result

No retained high-severity dependency or client-flow finding after critique,
fix, and verification.

The starter dependency on Next.js 16.0.8 produced three high-severity audit
findings. The client now pins Next.js 16.3.1 and `npm audit --omit=dev` reports
zero known vulnerabilities.

The transaction builder preserves the STRK20 Wallet API v6 action order:
shielded withdrawal to the helper, creator-directed open note, then helper
invocation with the wallet-resolved note ID as the final felt. Wallet discovery
accepts only Ready or Xverse. The browser never requests a viewing key.

Pass recovery was hardened against refreshes during proof generation. A pending
pass is written to local storage before the wallet request begins, updated with
the transaction hash after submission, and promoted only after confirmation.
Malformed local state is rejected.

## Verification

- `npm audit --omit=dev`: zero known vulnerabilities.
- `npm run typecheck`: passed.
- `npm run test:actions`: 4 passed, 0 failed.
- `GITHUB_ACTIONS=true npm run build`: passed with the `/veilpass` base path.
- Desktop and mobile browser checks covered the main page, wallet dialog,
  responsive privacy boundary, and pending-pass reload recovery.
- Browser console checks completed without errors or warnings.

Source hashes:

- `web/src/app/page.tsx`: `6c94dac08e0c043383a1278270bf46f0a692e44c5cfb2f740b61ef5358daa271`
- `web/src/lib/veilpass-actions.mjs`: `f10bc2b7abcfb8a4efc882b5d8df9972b4d6ff304ed1f3ab3394c8194221fc2a`
- `web/package.json`: `53ecba660bb39d7b2f2929d9ef5e22080229646622cee1661fe4790b949bf5a3`
- `web/package-lock.json`: `2cb00aa03d8d3d515893f9978a0aa7f2a04aeb2fa41f88e7fa2c0b879e41c303`

## Remaining gates

- The helper address is intentionally unset until the audited Cairo contract is
  deployed.
- A real Ready or Xverse extension flow cannot be represented by the headless
  browser checkpoint and must be verified on mainnet.
- Mainnet proof generation, transaction confirmation, and spend remain
  wallet-controlled actions.
