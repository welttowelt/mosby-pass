# Event offer and admission protocol

Mosby Pass binds a private payment to one event without putting the organizer
address or event details in the deployed helper calldata.

## Event offer

The organizer link contains the event name, venue, registered privacy address,
STRK amount, opening and closing times, and a random non-zero felt. The attendee
computes:

```text
event_commitment = Poseidon(
  organizer,
  amount,
  StarknetKeccak(event_name),
  StarknetKeccak(venue),
  opens_at,
  closes_at,
  nonce
)
```

Changing any field changes the commitment. Disabled form fields only guide the
normal client; the gate independently requires the expected commitment.

## Device credential

The attendee browser creates an ephemeral P-256 key pair. Its public key is
split into four 128-bit limbs and hashed with Poseidon. The deployed helper
stores a second Poseidon hash of that key identifier as the access commitment.
The private key remains in local browser state.

This improves on a plain bearer secret because a screenshot or copied public
payload cannot answer a new challenge. The current key is exportable browser
state, not a hardware-backed passkey, and an injected script in the same origin
could steal it. A production client should move the key into a wallet, secure
enclave, or non-exportable credential store.

## Payment activation

The Wallet API v6 action sequence is unchanged from the deployed helper:

1. withdraw shielded STRK to the helper;
2. create an open note for the organizer;
3. invoke the helper with token, amount, access commitment, duration, event
   commitment, and the wallet-resolved note ID.

The helper records state only after exact token approval succeeds. Its immutable
ABI retains membership-era names, but the stored primitive is general: payment,
opaque offer commitment, opaque access commitment, note ID, start, and expiry.

## Gate verification

The gate challenge contains the event commitment, a random nonce, and issue
time. It expires after five minutes. The attendee signs the canonical challenge
with ECDSA P-256. The scanner then:

1. requires the exact challenge object;
2. derives the access commitment from the supplied public key;
3. verifies the signature;
4. reads start, expiry, event commitment, and note ID from Starknet;
5. enforces the event window;
6. records local one-time consumption.

The reusable organizer verifier in `web/src/lib/verify-membership.mjs` retains a
mandatory private `receivedNote` callback. Public helper state cannot by itself
confirm the private note recipient. The interactive static demo can show the
pool-generated note identifier but cannot access the organizer viewing context.

## Known limits

- Event links disclose their terms to anyone who receives them.
- Amount, timing, helper, and opaque commitments remain public.
- Local consumption only blocks replay at one browser profile.
- Multi-gate replay resistance needs synchronized private state.
- The app does not hide a person's physical presence, face, IP, or device
  fingerprint.
