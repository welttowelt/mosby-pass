# Three-minute demo plan

Target length: 2 minutes 50 seconds. Record only after the helper is deployed
and all three `strk20.json` transactions are confirmed on mainnet.

## Recording script

### 0:00 to 0:20

Show the Veilpass home page and membership form.

Say:

> A creator membership normally links a subscriber's public wallet to a creator
> and a payment. Veilpass starts from shielded STRK instead. The creator receives
> a private open note, while the shared helper records only an access commitment
> and its expiry.

### 0:20 to 0:45

Hold on the public and hidden boundary near the top of the page.

Say:

> The helper, token, amount, time, and commitment remain public. STRK20 hides the
> subscriber wallet and the link to the creator. Ready owns the viewing key and
> generates the cryptographic proof. The dapp never asks for either.

### 0:45 to 1:15

Create a 30-day creator offer, copy the private link, then open its subscriber
view. Show that the recipient, price, and term are locked.

Say:

> The creator chooses the recipient, price, and term. Veilpass commits to those
> terms with a private offer nonce, without putting the creator address in the
> helper calldata. The publisher later checks the exact offer and duration, then
> confirms the creator received the wallet-resolved note.

### 1:15 to 1:45

Connect Ready on Starknet mainnet from the locked subscriber view and create the
membership with the smallest pre-approved demo amount. Keep the wallet
confirmation visible, but hide unrelated balances and account data.

Say:

> I am paying from an existing shielded STRK balance. Before the wallet request,
> Veilpass creates a random local secret and stores a recoverable pending pass.
> Ready assembles three STRK20 actions: shielded withdrawal, creator open note,
> and a pool-only helper call. It generates the proof, and I confirm the
> transaction in the wallet.

### 1:45 to 2:10

Show the confirmed transaction link. Open Voyager and point to successful
execution against the official pool. Then show the other two verified hashes in
`strk20.json`.

Say:

> This transaction succeeded on Starknet mainnet and touched the official STRK20
> pool. The repository lists three successful pool transactions for the sprint.
> These are live hashes, not test fixtures.

### 2:10 to 2:35

Return to Veilpass. Copy the pass secret, paste it into the verifier, and show
the active expiry returned from Starknet. Keep most of the secret out of frame.

Say:

> The chain stores a Poseidon commitment rather than the bearer secret. Veilpass
> hashes the secret locally and reads the activation, expiry, offer, and note
> commitment state. The publisher library additionally enforces the creator's
> exact term and private note receipt before returning protected content. This
> static demo does not claim that browser assets are private.

### 2:35 to 2:50

Show the audit files, green GitHub Actions run, and MIT license.

Say:

> The helper has fifteen passing contract tests, including access and note
> replay, caller, expiry, balance, and approval failures. Twelve client tests
> cover wallet actions, recovery, creator offers, and publisher verification.
> The dependency audit reports zero known vulnerabilities. The source,
> deployment hashes, and checks are public under the MIT license.

## Capture checklist

Before recording:

- Confirm the deployed helper returns the official pool from `get_pool`.
- Confirm the demo build contains the deployed helper address.
- Confirm every hash in `strk20.json` succeeded and touched the pool.
- Use the latest green CI and Pages runs from the same commit.
- Set the wallet to Starknet mainnet and pre-fund its shielded STRK balance.
- Choose the smallest demo payment approved by the user.
- Close unrelated tabs and hide notifications, balances, private keys, seed
  phrases, viewing keys, RPC credentials, and full bearer secrets.

After recording:

- Check the final runtime is no longer than three minutes.
- Watch the full export once for readable text, correct audio, and accidental
  secret exposure.
- Open every visible transaction hash and confirm it resolves on mainnet.
- Upload the final video publicly and add its URL as `demo_video` in
  `strk20.json`.
- Re-run `./scripts/verify-release.sh` and confirm GitHub CI stays green.

## Evidence placeholders

Fill these only from verified live state:

```text
helper address:
declaration transaction:
deployment transaction:
membership transaction 1:
membership transaction 2:
membership transaction 3:
video URL:
final commit:
```
