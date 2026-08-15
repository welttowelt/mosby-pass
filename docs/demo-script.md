# Mosby Pass three-minute demo

Target: 2 minutes 50 seconds. Record only after three qualifying STRK20
transactions are confirmed and listed in `strk20.json`.

## 0:00–0:25 — The promise

Show the hero and stacked files.

> A normal crypto ticket exposes the wallet that paid for it. Mosby Pass starts
> from shielded STRK. Scan the invitation, pay privately, and prove the pass at
> the door without giving the organizer your public wallet.

## 0:25–0:55 — Organizer file

Open **Organizer desk**, enter the smallest approved price, and generate the
event QR.

> The QR fixes the event, venue, organizer privacy address, price, and gate
> window. Mosby Pass hashes those exact terms into one event commitment.

## 0:55–1:35 — Attendee file

Open the QR link on the attendee device, connect Ready or Xverse on mainnet, and
confirm the STRK20 transaction.

> The browser creates a fresh signing key. The wallet privately withdraws
> shielded STRK, creates the organizer's open note, and records the device and
> event commitments through the deployed helper. The dapp never receives a
> viewing key or the attendee's public-wallet link.

Show the confirmed Voyager transaction without exposing unrelated balances.

## 1:35–2:20 — Gate file

Open **Gate scanner**, generate a fresh challenge, sign it on the attendee
device, and validate the proof.

> The attendee is not presenting a screenshot or reusable secret. The device
> signs a five-minute challenge. The gate checks that signature, the exact event,
> the admission window, and the paid mainnet record before showing ADMIT.

Run the same proof again and show the local replay rejection.

## 2:20–2:50 — Honest boundary

Show the privacy file, repository tests, and `strk20.json`.

> STRK20 hides the attendee wallet and the payment link to the organizer. The
> amount, timing, helper, and opaque commitments remain public. One-gate replay
> protection is implemented; synchronized multi-gate consumption requires a
> private organizer service. The repository, helper address, tests, and mainnet
> hashes are public.

## Capture gate

- Confirm the helper returns the official pool.
- Confirm all three listed transactions succeeded and touched that pool.
- Use a green CI and Pages deployment from the recorded commit.
- Show the Mosby Pass demo URL, not an old Veilpass Pages path.
- Hide balances, keys, seed phrases, notifications, and RPC credentials.
- Watch the full export once for readable type and accidental secrets.
- Add the public video URL to `strk20.json`.
