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

### 0:45 to 1:10

Show the route panel, then briefly show `buildMembershipActions` in the public
repository.

Say:

> The wallet prepares one atomic transaction with three actions. It withdraws
> from the shielded balance to the shared helper, creates an open note for the
> creator, and invokes Veilpass with the wallet-resolved note ID. The contract
> accepts calls only from the official STRK20 pool and approves exactly the
> payment amount back to that pool.

### 1:10 to 1:45

Connect Ready on Starknet mainnet. Enter the creator address, use the smallest
pre-approved demo amount, select a 30-day term, and create the membership. Keep
the wallet confirmation visible, but hide unrelated balances and account data.

Say:

> I am paying from an existing shielded STRK balance. Before the wallet request,
> Veilpass creates a random local secret and stores a recoverable pending pass.
> Ready assembles the STRK20 actions and generates the proof. I confirm the
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
> hashes the secret locally, reads the expiry, and confirms access. A publisher
> would perform this check on a server before returning protected content. This
> static demo does not claim that browser assets are private.

### 2:35 to 2:50

Show the audit files, green GitHub Actions run, and MIT license.

Say:

> The helper has twelve passing contract tests, including replay, caller,
> expiry, balance, and approval failures. The client has recovery tests and a
> dependency audit with zero known vulnerabilities. The source, deployment
> hashes, and checks are public under the MIT license.

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
