"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { createStore, type Store } from "@starknet-io/get-starknet-discovery";
import type { WalletWithStarknetFeatures } from "@starknet-io/get-starknet-wallet-standard/features";
import type { WALLET_API } from "@starknet-io/types-js";
import { RpcProvider, WalletAccountV6, constants, num, validateAndParseAddress, walletV6 } from "starknet";
import {
  LAST_PASS_KEY,
  PENDING_PASS_KEY,
  buildAdmissionActions,
  parseStoredPass,
  parseTokenAmount,
} from "../lib/veilpass-actions.mjs";
import type { StoredPass } from "../lib/veilpass-actions.mjs";
import {
  buildEventOfferUrl,
  createGateChallenge,
  generateAdmissionCredential,
  parseEventOffer,
  signGateChallenge,
  verifyGateProof,
} from "../lib/event-pass.mjs";
import type { EventOffer, GateChallenge } from "../lib/event-pass.mjs";

const STRK = "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";
const RPC_URL = process.env.NEXT_PUBLIC_STARKNET_RPC_URL ?? "https://starknet-mainnet.public.blastapi.io/rpc/v0_10";
const HELPER = process.env.NEXT_PUBLIC_VEILPASS_HELPER ?? "0x05dd2c68fa1c0fba3b425a7c855fbc0a60867763b2688bf44f2225d422173da6";
const MAX_DURATION_SECONDS = 366 * 24 * 60 * 60;
const provider = new RpcProvider({ nodeUrl: RPC_URL });
const STATIONS = [
  { id: "organizer", number: "01", name: "Organizer desk", detail: "Create event QR" },
  { id: "attendee", number: "02", name: "Attendee pass", detail: "Shielded STRK → pass" },
  { id: "gate", number: "03", name: "Gate scanner", detail: "Challenge → admit once" },
] as const;
type StationId = (typeof STATIONS)[number]["id"];

type TxState =
  | { kind: "idle" }
  | { kind: "proving"; detail: string }
  | { kind: "submitted"; hash: string }
  | { kind: "confirmed"; hash: string }
  | { kind: "error"; detail: string };

function compact(value: string): string {
  return value.length < 18 ? value : `${value.slice(0, 9)}…${value.slice(-6)}`;
}

function randomFelt(): string {
  const bytes = new Uint8Array(30);
  crypto.getRandomValues(bytes);
  if (bytes.every((byte) => byte === 0)) bytes[0] = 1;
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function localDateTime(seconds: number): string {
  const date = new Date(seconds * 1000);
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
}

function normalizeWalletName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function qrFor(value: string): Promise<string> {
  return QRCode.toDataURL(value, { width: 360, margin: 1, color: { dark: "#11110f", light: "#f4f0e6" } });
}

export default function Home() {
  const [wallets, setWallets] = useState<WalletWithStarknetFeatures[]>([]);
  const [walletPicker, setWalletPicker] = useState(false);
  const [walletAccount, setWalletAccount] = useState<WalletAccountV6>();
  const [address, setAddress] = useState("");
  const [chainId, setChainId] = useState("");
  const [title, setTitle] = useState("Midnight Assembly");
  const [venue, setVenue] = useState("Hall 20 · Berlin");
  const [organizer, setOrganizer] = useState("");
  const [amount, setAmount] = useState("0.1");
  const [startsInput, setStartsInput] = useState("");
  const [closesInput, setClosesInput] = useState("");
  const [eventOffer, setEventOffer] = useState<EventOffer>();
  const [offerLink, setOfferLink] = useState("");
  const [offerQr, setOfferQr] = useState("");
  const [offerStatus, setOfferStatus] = useState("No transaction is prepared while creating an event.");
  const [tx, setTx] = useState<TxState>({ kind: "idle" });
  const [pass, setPass] = useState<StoredPass>();
  const [gateChallenge, setGateChallenge] = useState<GateChallenge>();
  const [challengeText, setChallengeText] = useState("");
  const [challengeQr, setChallengeQr] = useState("");
  const [proofText, setProofText] = useState("");
  const [proofQr, setProofQr] = useState("");
  const [gateResult, setGateResult] = useState("");
  const [proofStatus, setProofStatus] = useState("");
  const [activeStation, setActiveStation] = useState<StationId>("organizer");

  useEffect(() => {
    const now = Math.floor(Date.now() / 1000);
    setStartsInput(localDateTime(now + 24 * 60 * 60));
    setClosesInput(localDateTime(now + 27 * 60 * 60));
    const loaded = parseEventOffer(window.location.search, (value) => validateAndParseAddress(value ?? ""), parseTokenAmount);
    if (!loaded) {
      if (window.location.search) setOfferStatus("This event link is incomplete or invalid.");
      return;
    }
    setEventOffer(loaded);
    setActiveStation("attendee");
    setTitle(loaded.title);
    setVenue(loaded.venue);
    setOrganizer(loaded.organizer);
    setAmount(loaded.amountText);
    setStartsInput(localDateTime(loaded.startsAt));
    setClosesInput(localDateTime(loaded.closesAt));
    setOfferLink(window.location.href);
    setOfferStatus("Event loaded. Price, recipient, venue and admission window are cryptographically bound.");
  }, []);

  useEffect(() => {
    const store: Store = createStore({ eip1193Adapters: [] });
    const update = (next: WalletWithStarknetFeatures[]) => setWallets(next.filter((wallet) => {
      const name = normalizeWalletName(wallet.name);
      return name.includes("ready") || name.includes("xverse");
    }));
    update(store.getWallets());
    const unsubscribe = store.subscribe((next) => update(next.slice()));
    return unsubscribe;
  }, []);

  useEffect(() => {
    const pending = parseStoredPass(localStorage.getItem(PENDING_PASS_KEY));
    const previous = parseStoredPass(localStorage.getItem(LAST_PASS_KEY));
    const recovered = pending ?? previous;
    if (!recovered) return;
    setPass(recovered);
    if (!pending) return;
    if (!pending.transactionHash) {
      setTx({ kind: "error", detail: "Recovered an unused device key from an interrupted wallet request. Start again when ready." });
      return;
    }
    let cancelled = false;
    setTx({ kind: "submitted", hash: pending.transactionHash });
    provider.waitForTransaction(pending.transactionHash, { retries: 400, retryInterval: 3000 }).then((receipt) => {
      if (cancelled) return;
      if ("execution_status" in receipt && receipt.execution_status === "REVERTED") {
        setTx({ kind: "error", detail: "The recovered transaction reverted on Starknet." });
        return;
      }
      localStorage.setItem(LAST_PASS_KEY, JSON.stringify(pending));
      localStorage.removeItem(PENDING_PASS_KEY);
      setTx({ kind: "confirmed", hash: pending.transactionHash });
    }).catch((error) => {
      if (!cancelled) setTx({ kind: "error", detail: `Could not refresh the transaction. The device key remains local. ${String(error)}` });
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { if (offerLink) void qrFor(offerLink).then(setOfferQr); }, [offerLink]);
  useEffect(() => { if (challengeText) void qrFor(challengeText).then(setChallengeQr); }, [challengeText]);
  useEffect(() => { if (proofText) void qrFor(proofText).then(setProofQr); }, [proofText]);

  const helperReady = useMemo(() => {
    try { return num.toBigInt(HELPER) !== 0n; } catch { return false; }
  }, []);
  const isMainnet = chainId === constants.StarknetChainId.SN_MAIN;
  const eventLocked = Boolean(eventOffer);
  const orderedStations = [
    ...STATIONS.filter((station) => station.id !== activeStation),
    ...STATIONS.filter((station) => station.id === activeStation),
  ];

  async function connect(wallet: WalletWithStarknetFeatures) {
    setTx({ kind: "idle" });
    try {
      const account = await WalletAccountV6.connect(provider, wallet);
      const accounts = await walletV6.requestAccounts(wallet);
      if (!Array.isArray(accounts) || !accounts[0]) throw new Error("This wallet did not return a Starknet account.");
      const connectedAddress = validateAndParseAddress(accounts[0]);
      setWalletAccount(account);
      setAddress(connectedAddress);
      setChainId(await walletV6.requestChainId(wallet) as string);
      if (!eventLocked) setOrganizer(connectedAddress);
      setWalletPicker(false);
    } catch (error) {
      setTx({ kind: "error", detail: error instanceof Error ? error.message : String(error) });
    }
  }

  async function createOffer() {
    try {
      const organizerAddress = validateAndParseAddress(organizer);
      parseTokenAmount(amount);
      const startsAt = Math.floor(new Date(startsInput).getTime() / 1000);
      const closesAt = Math.floor(new Date(closesInput).getTime() / 1000);
      if (!Number.isSafeInteger(startsAt) || !Number.isSafeInteger(closesAt)) throw new Error("Choose a valid event window.");
      if (closesAt <= Math.floor(Date.now() / 1000)) throw new Error("The admission window must close in the future.");
      if (closesAt - Math.floor(Date.now() / 1000) > MAX_DURATION_SECONDS) throw new Error("The helper supports events up to 366 days away.");
      const link = buildEventOfferUrl({
        baseUrl: `${window.location.origin}${window.location.pathname}`,
        organizer: organizerAddress,
        amount,
        title,
        venue,
        startsAt,
        closesAt,
        nonce: randomFelt(),
      });
      const parsed = parseEventOffer(
        new URL(link).search,
        (value) => validateAndParseAddress(value ?? ""),
        parseTokenAmount,
      );
      if (!parsed) throw new Error("Could not encode the event offer.");
      setEventOffer(parsed);
      setOfferLink(link);
      setOfferStatus("Event QR ready. It carries public terms, not an attendee identity.");
      try { await navigator.clipboard.writeText(link); } catch { /* Manual copy remains available. */ }
    } catch (error) {
      setOfferStatus(error instanceof Error ? error.message : String(error));
    }
  }

  async function buyPass() {
    if (!walletAccount || !address) { setWalletPicker(true); return; }
    try {
      if (!isMainnet) throw new Error("Switch the connected wallet to Starknet mainnet.");
      if (!helperReady) throw new Error("The mainnet helper is not configured.");
      if (!eventOffer) throw new Error("Open an organizer event link first.");
      const now = Math.floor(Date.now() / 1000);
      const durationSeconds = eventOffer.closesAt - now;
      if (durationSeconds <= 0 || durationSeconds > MAX_DURATION_SECONDS) throw new Error("This event is outside the helper admission window.");
      const credential = await generateAdmissionCredential();
      const pendingPass: StoredPass = {
        ...credential,
        offerCommitment: eventOffer.commitment,
        eventTitle: eventOffer.title,
        venue: eventOffer.venue,
        startsAt: eventOffer.startsAt,
        closesAt: eventOffer.closesAt,
        transactionHash: "",
      };
      localStorage.setItem(PENDING_PASS_KEY, JSON.stringify(pendingPass));
      setPass(pendingPass);
      const actions = buildAdmissionActions({
        token: STRK,
        helper: num.toHex(HELPER),
        creator: eventOffer.organizer,
        amount: eventOffer.amount,
        commitment: credential.commitment,
        offerCommitment: eventOffer.commitment,
        durationSeconds,
        toHex: num.toHex,
      }) as WALLET_API.STRK20_ACTION[];
      setTx({ kind: "proving", detail: "Approve in your wallet. The privacy proof can take around 30 seconds." });
      const response = await walletAccount.strk20InvokeTransaction(actions);
      const submittedPass = { ...pendingPass, transactionHash: response.transaction_hash };
      localStorage.setItem(PENDING_PASS_KEY, JSON.stringify(submittedPass));
      setPass(submittedPass);
      setTx({ kind: "submitted", hash: response.transaction_hash });
      const receipt = await provider.waitForTransaction(response.transaction_hash, { retries: 400, retryInterval: 3000 });
      if ("execution_status" in receipt && receipt.execution_status === "REVERTED") throw new Error("The transaction reverted on Starknet.");
      localStorage.setItem(LAST_PASS_KEY, JSON.stringify(submittedPass));
      localStorage.removeItem(PENDING_PASS_KEY);
      setPass(submittedPass);
      setTx({ kind: "confirmed", hash: response.transaction_hash });
    } catch (error) {
      setTx({ kind: "error", detail: error instanceof Error ? error.message : String(error) });
    }
  }

  async function openGate() {
    if (!eventOffer) { setGateResult("Load or create an event first."); return; }
    const challenge = createGateChallenge(eventOffer.commitment);
    const encoded = JSON.stringify(challenge);
    setGateChallenge(challenge);
    setChallengeText(encoded);
    setProofText("");
    setProofQr("");
    setGateResult("Fresh five-minute challenge ready. Send it to the attendee device.");
    try { await navigator.clipboard.writeText(encoded); } catch { /* Manual copy remains available. */ }
  }

  async function proveAdmission() {
    try {
      if (!pass) throw new Error("No admission pass is stored in this browser.");
      const challenge = JSON.parse(challengeText) as GateChallenge;
      const proof = await signGateChallenge(pass, challenge);
      const encoded = JSON.stringify(proof);
      setProofText(encoded);
      setProofStatus("Signed locally. The private key never enters the gate payload.");
      try { await navigator.clipboard.writeText(encoded); } catch { /* Manual copy remains available. */ }
    } catch (error) {
      setProofStatus(error instanceof Error ? error.message : String(error));
    }
  }

  async function admit() {
    setGateResult("Checking signature and Starknet state…");
    try {
      if (!eventOffer || !gateChallenge) throw new Error("Open a fresh gate challenge first.");
      const proof = JSON.parse(proofText) as Record<string, unknown>;
      const local = await verifyGateProof(proof, gateChallenge);
      if (!local.valid || !local.commitment) throw new Error(`Credential rejected: ${local.reason}.`);
      if (gateChallenge.offerCommitment !== eventOffer.commitment) throw new Error("Gate is configured for a different event.");
      const usedKey = `veilpass:admitted:${eventOffer.commitment}:${local.commitment}`;
      if (localStorage.getItem(usedKey)) throw new Error("Replay blocked: this gate has already admitted the pass.");
      const [startedResult, expiryResult, offerResult, noteResult] = await Promise.all([
        provider.callContract({ contractAddress: HELPER, entrypoint: "get_started", calldata: [local.commitment] }),
        provider.callContract({ contractAddress: HELPER, entrypoint: "get_expiry", calldata: [local.commitment] }),
        provider.callContract({ contractAddress: HELPER, entrypoint: "get_offer", calldata: [local.commitment] }),
        provider.callContract({ contractAddress: HELPER, entrypoint: "get_note", calldata: [local.commitment] }),
      ]);
      const started = Number(num.toBigInt(startedResult[0] ?? "0x0"));
      const expiry = Number(num.toBigInt(expiryResult[0] ?? "0x0"));
      const onchainOffer = num.toHex(offerResult[0] ?? "0x0");
      const note = num.toHex(noteResult[0] ?? "0x0");
      const now = Math.floor(Date.now() / 1000);
      if (!started || !expiry || note === "0x0") throw new Error("No paid pass exists for this credential.");
      if (onchainOffer !== eventOffer.commitment) throw new Error("The paid pass belongs to a different event.");
      if (now < eventOffer.startsAt) throw new Error("The admission window has not opened.");
      if (now >= eventOffer.closesAt || now >= expiry) throw new Error("The admission window has closed.");
      localStorage.setItem(usedKey, String(now));
      setGateResult(`ADMIT · device signature valid · paid event commitment ${compact(onchainOffer)} · note ${compact(note)}`);
    } catch (error) {
      setGateResult(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <main>
      <div className="grain" aria-hidden="true" />
      <nav className="nav">
        <a className="wordmark" href="#top" aria-label="Mosby Pass home">MOSBY<span>/</span>PASS</a>
        <div className="navClaim">PRIVATE EVENT ADMISSION · STARKNET</div>
        <button className="walletButton" onClick={() => setWalletPicker(true)}>{address ? compact(address) : "Connect privacy wallet"}</button>
      </nav>

      <section className="hero" id="top">
        <div className="eyebrow">A PAYMENT SHOULD OPEN THE DOOR — NOT YOUR WALLET HISTORY</div>
        <h1>PRIVATE ADMISSION</h1>
        <p className="heroCopy">Mosby Pass turns shielded STRK into a device-bound event pass. Scan the invitation, pay privately, and prove the pass at the door without exposing your public wallet.</p>
      </section>

      <section className="routeStrip" aria-label="Mosby Pass flow">
        {orderedStations.map((station) => (
          <button
            key={station.id}
            className={`folderTab folderTab-${station.id} ${activeStation === station.id ? "active" : ""}`}
            onClick={() => setActiveStation(station.id)}
          >
            <b>{station.number}</b><span>{station.name}</span><small>{station.detail}</small>
          </button>
        ))}
      </section>

      {activeStation === "organizer" && (
      <section className="station station-organizer">
        <header><span>STATION 01</span><h2>Print the invitation.</h2><p>The QR fixes the event, venue, price, recipient and gate window. It contains no attendee identity.</p></header>
        <div className="formGrid">
          <label>Event<input value={title} onChange={(event) => setTitle(event.target.value)} disabled={eventLocked} /></label>
          <label>Venue<input value={venue} onChange={(event) => setVenue(event.target.value)} disabled={eventLocked} /></label>
          <label className="wide">Organizer&apos;s registered privacy address<input value={organizer} onChange={(event) => setOrganizer(event.target.value)} placeholder="0x…" disabled={eventLocked} /></label>
          <label>Price<div className="amountField"><input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" disabled={eventLocked} /><span>STRK</span></div></label>
          <label>Doors open<input type="datetime-local" value={startsInput} onChange={(event) => setStartsInput(event.target.value)} disabled={eventLocked} /></label>
          <label>Doors close<input type="datetime-local" value={closesInput} onChange={(event) => setClosesInput(event.target.value)} disabled={eventLocked} /></label>
          <div className="wide actionLine">
            {!eventLocked ? <button className="primary" onClick={createOffer}>Generate event QR <span>↗</span></button> : <a className="resetLink" href="./">Create another event</a>}
            <p role="status">{offerStatus}</p>
          </div>
        </div>
        <aside className="qrTicket">
          <div className="ticketTop"><span>{eventOffer?.title ?? "EVENT QR"}</span><b>№ 001</b></div>
          {offerQr ? <img src={offerQr} alt="Event offer QR code" /> : <div className="qrPlaceholder">QR<br />PENDING</div>}
          <code>{offerLink ? compact(offerLink) : "terms become a shareable link"}</code>
        </aside>
      </section>
      )}

      {activeStation === "attendee" && (
      <section className="station station-attendee">
        <header><span>STATION 02</span><h2>Pay without checking in publicly.</h2><p>Ready or Xverse constructs the privacy proof. Mosby Pass receives neither the viewing key nor the public-wallet link.</p></header>
        <div className="eventBill">
          <div className="billMeta"><span>ADMISSION FOR</span><b>{eventOffer?.title ?? "Open an event QR"}</b></div>
          <dl>
            <div><dt>Venue</dt><dd>{eventOffer?.venue ?? "—"}</dd></div>
            <div><dt>Window</dt><dd>{eventOffer ? `${new Date(eventOffer.startsAt * 1000).toLocaleString()} → ${new Date(eventOffer.closesAt * 1000).toLocaleTimeString()}` : "—"}</dd></div>
            <div><dt>Total</dt><dd>{eventOffer?.amountText ?? "—"} STRK</dd></div>
          </dl>
          <button className="primary buyButton" onClick={buyPass} disabled={!eventOffer || tx.kind === "proving" || tx.kind === "submitted"}>
            {!eventOffer ? "Scan an event first" : address ? "Pay privately & activate pass" : "Connect wallet & continue"}<span>↗</span>
          </button>
          <div className={`status status-${tx.kind}`} role="status">
            {tx.kind === "idle" && "No transaction is prepared until you confirm."}
            {tx.kind === "proving" && tx.detail}
            {tx.kind === "submitted" && <>Submitted · <a href={`https://voyager.online/tx/${tx.hash}`} target="_blank" rel="noreferrer">{compact(tx.hash)}</a></>}
            {tx.kind === "confirmed" && <>Pass active · <a href={`https://voyager.online/tx/${tx.hash}`} target="_blank" rel="noreferrer">transaction {compact(tx.hash)}</a></>}
            {tx.kind === "error" && tx.detail}
          </div>
        </div>
        <aside className={`devicePass ${pass ? "devicePass-live" : ""}`}>
          <div className="passNotch" />
          <span>DEVICE PASS</span>
          <h3>{pass?.eventTitle ?? "Created after payment"}</h3>
          <p>{pass?.venue ?? "A fresh signing key stays in this browser."}</p>
          <code>{pass ? compact(pass.commitment) : "NO CREDENTIAL"}</code>
          <b>{pass ? "READY FOR CHALLENGE" : "INACTIVE"}</b>
        </aside>
      </section>
      )}

      {activeStation === "gate" && (
      <section className="station station-gate">
        <header><span>STATION 03</span><h2>Prove the pass. Not the person.</h2><p>A fresh challenge blocks screenshots and copied bearer codes. This MVP consumes passes locally on one gate device.</p></header>
        <div className="gateConsole">
          <div className="gateStep">
            <b>GATE</b><span>Issue a five-minute challenge</span>
            <button onClick={openGate} disabled={!eventOffer}>Open gate</button>
            {challengeQr && <img src={challengeQr} alt="Gate challenge QR code" />}
            <textarea value={challengeText} onChange={(event) => setChallengeText(event.target.value)} placeholder="Challenge JSON" aria-label="Gate challenge" />
          </div>
          <div className="gateStep">
            <b>ATTENDEE</b><span>Sign on the pass device</span>
            <button onClick={proveAdmission} disabled={!challengeText || !pass}>Create admission proof</button>
            {proofQr && <img src={proofQr} alt="Signed admission proof QR code" />}
            <textarea value={proofText} onChange={(event) => setProofText(event.target.value)} placeholder="Signed proof JSON" aria-label="Admission proof" />
            <small>{proofStatus}</small>
          </div>
          <div className="gateStep gateDecision">
            <b>SCANNER</b><span>Verify device + event + payment + time</span>
            <button onClick={admit} disabled={!proofText || !gateChallenge}>Validate & admit</button>
            <div className={gateResult.startsWith("ADMIT") ? "admitSignal active" : "admitSignal"}>{gateResult.startsWith("ADMIT") ? "ADMIT" : "HOLD"}</div>
            <p role="status">{gateResult || "Waiting for a fresh signed proof."}</p>
          </div>
        </div>
      </section>
      )}

      <section className="truthSection">
        <div><span>HIDDEN</span><h2>Attendee wallet<br />Private balance<br />Organizer link</h2></div>
        <div><span>PUBLIC</span><h2>Helper · token · amount<br />time · opaque commitments</h2></div>
        <p>Mosby Pass does not hide faces, IP addresses, device fingerprints, transaction amounts or timing. The browser-held key is an MVP credential, not a hardware-backed passkey. Multi-gate replay protection requires an organizer-operated private gate service.</p>
      </section>

      <footer>
        <span>MOSBY PASS / PRIVATE EVENT ADMISSION</span>
        <a href={`https://voyager.online/contract/${HELPER}`} target="_blank" rel="noreferrer">MAINNET HELPER {compact(HELPER)} ↗</a>
        <span>NO VIEWING KEY IN THE DAPP</span>
      </footer>

      {walletPicker && (
        <div className="modalBackdrop" onClick={() => setWalletPicker(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="wallet-dialog-title" onClick={(event) => event.stopPropagation()}>
            <button className="modalClose" onClick={() => setWalletPicker(false)} aria-label="Close">×</button>
            <div className="eyebrow">WALLET API V6</div>
            <h2 id="wallet-dialog-title">Select a privacy wallet</h2>
            <p>Ready and Xverse expose STRK20 actions while keeping the viewing key inside the wallet.</p>
            <div className="walletList">
              {wallets.length ? wallets.map((wallet) => (
                <button key={wallet.name} onClick={() => connect(wallet)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={wallet.icon} alt="" /><span>{wallet.name}</span><b>Connect ↗</b>
                </button>
              )) : <div className="noWallet">No compatible privacy wallet was discovered in this browser.</div>}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
