# Veilpass client security checkpoint

Date: 2026-08-15
Scope: `web/src`, `web/tests`, `web/package.json`, `web/package-lock.json`
Runtime: Node.js 24, npm 11.8.0, Next.js 16.3.1, starknet.js 10.4.0

## Result

No high-severity dependency or client-flow finding remains after the current
critique, fixes, and verification.

The starter dependency on Next.js 16.0.8 produced three high-severity audit
findings. The client now pins Next.js 16.3.1, and `npm audit --omit=dev` reports
zero known vulnerabilities.

## Flow controls

- Wallet discovery accepts only Ready or Xverse and never requests a viewing
  key.
- Creator offer links validate the address, positive STRK amount, supported
  duration, and non-zero random nonce. The loaded recipient, amount, and term
  are locked in the normal subscriber interface.
- The transaction builder preserves the STRK20 action order: shielded withdrawal
  to the helper, creator-directed open note, then helper invocation with the
  wallet-resolved note ID as the final felt.
- The helper call passes a duration, not a browser-clock expiry. The helper
  derives start and expiry from one Starknet timestamp.
- A pending bearer secret is written before proof generation, updated after
  submission, and promoted only after confirmation. Malformed local state is
  rejected.
- The reusable publisher verifier checks the exact offer, duration, active
  expiry, and creator-confirmed note receipt. It refuses to report valid access
  when the private receipt callback is absent.

Disabled form controls are user guidance. They are not treated as enforcement.
The publisher verifier and creator-side note receipt check enforce the offer
against a modified client.

## Verification

- `npm audit --omit=dev`: zero known vulnerabilities.
- `npm run typecheck`: passed.
- `npm run test:actions`: 12 passed, 0 failed.
- `GITHUB_ACTIONS=true npm run build`: passed with the `/veilpass` base path.
- Production desktop and mobile checks covered creator offer generation,
  subscriber locking, malformed offers, wallet dialog semantics, and entitlement
  display.
- The production browser console completed without errors or warnings.

Source hashes:

- `web/src/app/page.tsx`: `4c524990f068151bf43ac78ce099f4ea1ecde7bd45b9fa0b193ef83272d3d93f`
- `web/src/lib/veilpass-actions.mjs`: `780a9c03364bd291479ff76f299936881e85738d9ecefbf7cb28b03bd0f796e0`
- `web/src/lib/verify-membership.mjs`: `1d9b30205a30771cc7cf6ff695bef7a3d540bfc8abcb10424a141d1bf0b51e60`
- `web/tests/veilpass-actions.test.mjs`: `1dd391a7f0e88397d08fd168c4ee88b1f8e197f55de15183c48b5ed8aa004523`
- `web/tests/verify-membership.test.mjs`: `22ca29a8665c6d1cffbc9a279b800f66611be51aba648eab622e72d2fb345088`
- `web/package.json`: `53ecba660bb39d7b2f2929d9ef5e22080229646622cee1661fe4790b949bf5a3`
- `web/package-lock.json`: `2cb00aa03d8d3d515893f9978a0aa7f2a04aeb2fa41f88e7fa2c0b879e41c303`

## Remaining gates

- The helper address stays unset until the verified Cairo class is deployed.
- A headless browser cannot complete a real Ready or Xverse extension proof
  flow. Mainnet confirmation remains wallet-controlled.
- Each publisher must implement creator note receipt against its own wallet or
  viewing service and check the expected token and amount.
- Offer links need a private delivery channel; public leakage enables offer
  correlation.
