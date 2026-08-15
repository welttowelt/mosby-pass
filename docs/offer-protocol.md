# Creator offer and access protocol

Veilpass binds each prepaid membership to terms chosen by the creator without
putting the creator address in the helper calldata.

## Commitments

The creator generates a private offer link containing:

- the creator's registered privacy address;
- the STRK amount;
- one of the supported access terms;
- a random non-zero felt used as the offer nonce.

The subscriber client computes:

```text
offer_commitment = Poseidon(creator, amount, duration_days, offer_nonce)
access_commitment = Poseidon(access_secret)
```

The creator address goes to the STRK20 open-note action, not the helper call.
The helper records the offer commitment, access commitment, activation time,
expiry, and wallet-resolved note ID only after exact token approval succeeds.
Each access commitment and note ID can be recorded once.

## Publisher verification

The reusable verifier is
[`web/src/lib/verify-membership.mjs`](../web/src/lib/verify-membership.mjs).
A publisher supplies the bearer secret, its expected offer commitment and term,
plus a callback backed by the creator wallet's private viewing context.

The verifier:

1. hashes the bearer secret locally;
2. reads `get_started`, `get_expiry`, `get_offer`, and `get_note` from Starknet;
3. requires the exact creator offer commitment;
4. requires `expiry == started_at + expected_duration`;
5. rejects expired records;
6. asks the creator wallet to confirm that the recorded note ID was received
   with the expected token and amount.

The callback is mandatory. Public helper state alone cannot confirm the private
note recipient.

```js
const result = await verifyMembership({
  provider,
  helper,
  secret: bearerSecret,
  expectedOfferCommitment,
  expectedDurationSeconds: 30 * 24 * 60 * 60,
  receivedNote: async (noteId) => creatorWallet.receivedNote({
    noteId,
    token: STRK,
    amount: expectedAmount,
  }),
});
```

`receivedNote` is an integration boundary, not a standardized wallet method.
The publisher must implement it against the creator wallet or viewing service
it controls. Veilpass never receives the viewing key.

## Adversarial cases

- Changing the recipient, price, or term in a modified browser client produces
  a different offer commitment or an unconfirmed note. The publisher rejects it.
- Asking for a longer expiry fails the exact start-to-expiry duration check.
- Reusing an earlier creator note fails the helper's global note replay check.
- Reusing a bearer secret fails the access-commitment replay check.
- A failed token approval leaves the access, offer, start, expiry, and note state
  unwritten.

Disabled browser fields only guide the normal flow. Publisher verification and
creator-side note receipt enforce the offer.

## Privacy boundary

Share creator offer links through a private channel. If an offer link becomes
public, its nonce lets an observer recompute that offer commitment from the
visible creator, amount, and term, then correlate it with helper state.

The public chain still exposes the helper, token, amount, activation time,
expiry, opaque offer commitment, opaque access commitment, and note ID. STRK20
hides the subscriber wallet and the open-note recipient link. The static demo
does not make browser assets private.
