"use client";

import { useEffect, useMemo, useState } from "react";
import { createStore, type Store } from "@starknet-io/get-starknet-discovery";
import type { WalletWithStarknetFeatures } from "@starknet-io/get-starknet-wallet-standard/features";
import type { WALLET_API } from "@starknet-io/types-js";
import {
  RpcProvider,
  WalletAccountV6,
  constants,
  hash,
  num,
  validateAndParseAddress,
  walletV6,
} from "starknet";
import {
  LAST_PASS_KEY,
  PENDING_PASS_KEY,
  buildOfferUrl,
  buildMembershipActions,
  parseOfferParams,
  parseStoredPass,
  parseTokenAmount,
} from "../lib/veilpass-actions.mjs";
import type { StoredPass } from "../lib/veilpass-actions.mjs";

const STRK = "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";
const RPC_URL =
  process.env.NEXT_PUBLIC_STARKNET_RPC_URL ??
  "https://starknet-mainnet.public.blastapi.io/rpc/v0_10";
const HELPER =
  process.env.NEXT_PUBLIC_VEILPASS_HELPER ??
  "0x05dd2c68fa1c0fba3b425a7c855fbc0a60867763b2688bf44f2225d422173da6";
const provider = new RpcProvider({ nodeUrl: RPC_URL });

type TxState =
  | { kind: "idle" }
  | { kind: "proving"; detail: string }
  | { kind: "submitted"; hash: string }
  | { kind: "confirmed"; hash: string }
  | { kind: "error"; detail: string };

type Pass = StoredPass;

function compact(value: string): string {
  return value.length < 16 ? value : `${value.slice(0, 8)}…${value.slice(-5)}`;
}

function freshSecret(): string {
  const bytes = new Uint8Array(30);
  crypto.getRandomValues(bytes);
  if (bytes.every((byte) => byte === 0)) bytes[0] = 1;
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function commitmentFor(secret: string): string {
  return num.toHex(hash.computePoseidonHashOnElements([secret]));
}

function offerCommitmentFor(
  creator: string,
  amount: bigint,
  days: number,
  nonce: string,
): string {
  return num.toHex(hash.computePoseidonHashOnElements([creator, amount, days, nonce]));
}

function normalizeWalletName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export default function Home() {
  const [wallets, setWallets] = useState<WalletWithStarknetFeatures[]>([]);
  const [walletPicker, setWalletPicker] = useState(false);
  const [walletAccount, setWalletAccount] = useState<WalletAccountV6>();
  const [address, setAddress] = useState("");
  const [chainId, setChainId] = useState("");
  const [creator, setCreator] = useState("");
  const [amount, setAmount] = useState("0.1");
  const [days, setDays] = useState(30);
  const [offerNonce, setOfferNonce] = useState("");
  const [offerLocked, setOfferLocked] = useState(false);
  const [offerLink, setOfferLink] = useState("");
  const [offerStatus, setOfferStatus] = useState("");
  const [tx, setTx] = useState<TxState>({ kind: "idle" });
  const [pass, setPass] = useState<Pass>();
  const [passInput, setPassInput] = useState("");
  const [accessResult, setAccessResult] = useState("");

  useEffect(() => {
    const store: Store = createStore({ eip1193Adapters: [] });
    const update = (next: WalletWithStarknetFeatures[]) => {
      setWallets(next.filter((wallet) => {
        const name = normalizeWalletName(wallet.name);
        return name.includes("ready") || name.includes("xverse");
      }));
    };
    update(store.getWallets());
    const unsubscribe = store.subscribe((next) => update(next.slice()));
    return unsubscribe;
  }, []);

  useEffect(() => {
    const loadedOffer = parseOfferParams(window.location.search, validateAndParseAddress);
    if (!loadedOffer) {
      if (window.location.search) setOfferStatus("This creator offer link is incomplete or invalid.");
      return;
    }
    setCreator(loadedOffer.creator);
    setAmount(loadedOffer.amount);
    setDays(loadedOffer.days);
    setOfferNonce(loadedOffer.nonce);
    setOfferLocked(true);
    setOfferStatus("Creator offer loaded. Its price, term, and recipient are locked for this pass.");
  }, []);

  useEffect(() => {
    const pending = parseStoredPass(localStorage.getItem(PENDING_PASS_KEY));
    const previous = parseStoredPass(localStorage.getItem(LAST_PASS_KEY));
    const recovered = pending ?? previous;
    if (!recovered) return;

    setPass(recovered);
    setPassInput(recovered.secret);
    if (!pending) return;
    if (!pending.transactionHash) {
      setTx({
        kind: "error",
        detail: "Recovered an unused pass secret from an interrupted wallet request. Start a new membership when ready.",
      });
      return;
    }

    let cancelled = false;
    setTx({ kind: "submitted", hash: pending.transactionHash });
    provider.waitForTransaction(pending.transactionHash, { retries: 400, retryInterval: 3000 })
      .then((receipt) => {
        if (cancelled) return;
        if ("execution_status" in receipt && receipt.execution_status === "REVERTED") {
          setTx({ kind: "error", detail: "The recovered transaction reverted on Starknet." });
          return;
        }
        localStorage.setItem(LAST_PASS_KEY, JSON.stringify(pending));
        localStorage.removeItem(PENDING_PASS_KEY);
        setTx({ kind: "confirmed", hash: pending.transactionHash });
      })
      .catch((error) => {
        if (!cancelled) {
          setTx({
            kind: "error",
            detail: `Could not refresh transaction status. Your pass secret is still stored locally. ${error instanceof Error ? error.message : String(error)}`,
          });
        }
      });
    return () => { cancelled = true; };
  }, []);

  const helperReady = useMemo(() => {
    try {
      return num.toBigInt(HELPER) !== 0n;
    } catch {
      return false;
    }
  }, []);

  const isMainnet = chainId === constants.StarknetChainId.SN_MAIN;

  async function connect(wallet: WalletWithStarknetFeatures) {
    setTx({ kind: "idle" });
    try {
      const account = await WalletAccountV6.connect(provider, wallet);
      const accounts = await walletV6.requestAccounts(wallet);
      if (!Array.isArray(accounts) || !accounts[0]) {
        throw new Error("This wallet did not return a Starknet account.");
      }
      const connectedAddress = validateAndParseAddress(accounts[0]);
      const connectedChain = (await walletV6.requestChainId(wallet)) as string;
      setWalletAccount(account);
      setAddress(connectedAddress);
      if (!offerLocked) setCreator(connectedAddress);
      setChainId(connectedChain);
      setWalletPicker(false);
    } catch (error) {
      setTx({ kind: "error", detail: error instanceof Error ? error.message : String(error) });
    }
  }

  async function createOffer() {
    try {
      const creatorAddress = validateAndParseAddress(creator);
      parseTokenAmount(amount);
      const nonce = freshSecret();
      const link = buildOfferUrl({
        baseUrl: `${window.location.origin}${window.location.pathname}`,
        creator: creatorAddress,
        amount,
        days,
        nonce,
      });
      setOfferNonce(nonce);
      setOfferLink(link);
      setOfferStatus("Offer ready. Open the subscriber view before making a membership payment.");
      try {
        await navigator.clipboard.writeText(link);
        setOfferStatus("Creator offer link copied. Open the subscriber view before making a payment.");
      } catch {
        setOfferStatus("Offer ready. Copy the displayed link manually.");
      }
    } catch (error) {
      setOfferStatus(error instanceof Error ? error.message : String(error));
    }
  }

  async function join() {
    if (!walletAccount || !address) {
      setWalletPicker(true);
      return;
    }
    try {
      if (!isMainnet) throw new Error("Switch the connected wallet to Starknet mainnet.");
      if (!helperReady) throw new Error("The mainnet helper address has not been configured yet.");
      if (!offerLocked || !offerNonce) throw new Error("Open a creator offer link before subscribing.");
      const creatorAddress = validateAndParseAddress(creator);
      const rawAmount = parseTokenAmount(amount);
      const secret = freshSecret();
      const commitment = commitmentFor(secret);
      const offerCommitment = offerCommitmentFor(creatorAddress, rawAmount, days, offerNonce);
      const durationSeconds = days * 24 * 60 * 60;
      const expiry = Math.floor(Date.now() / 1000) + durationSeconds;
      const helper = num.toHex(HELPER);
      const actions = buildMembershipActions({
        token: STRK,
        helper,
        creator: creatorAddress,
        amount: rawAmount,
        commitment,
        offerCommitment,
        durationSeconds,
        toHex: num.toHex,
      }) as WALLET_API.STRK20_ACTION[];

      const pendingPass = { secret, commitment, offerCommitment, expiry, transactionHash: "" };
      localStorage.setItem(PENDING_PASS_KEY, JSON.stringify(pendingPass));
      setPass(pendingPass);
      setPassInput(secret);

      setTx({ kind: "proving", detail: "Approve in your wallet. Private proof generation can take around 30 seconds." });
      const response = await walletAccount.strk20InvokeTransaction(actions);
      const transactionHash = response.transaction_hash;
      const submittedPass = { ...pendingPass, transactionHash };
      localStorage.setItem(PENDING_PASS_KEY, JSON.stringify(submittedPass));
      setPass(submittedPass);
      setTx({ kind: "submitted", hash: transactionHash });
      const receipt = await provider.waitForTransaction(transactionHash, {
        retries: 400,
        retryInterval: 3000,
      });
      if ("execution_status" in receipt && receipt.execution_status === "REVERTED") {
        throw new Error("The transaction reverted on Starknet.");
      }
      const nextPass = submittedPass;
      localStorage.setItem(LAST_PASS_KEY, JSON.stringify(nextPass));
      localStorage.removeItem(PENDING_PASS_KEY);
      setPass(nextPass);
      setPassInput(secret);
      setTx({ kind: "confirmed", hash: transactionHash });
    } catch (error) {
      setTx({ kind: "error", detail: error instanceof Error ? error.message : String(error) });
    }
  }

  async function verifyAccess() {
    setAccessResult("Checking Starknet…");
    try {
      if (!helperReady) throw new Error("The verifier becomes available after mainnet deployment.");
      const commitment = commitmentFor(passInput.trim());
      const [startedResult, expiryResult, offerResult, noteResult] = await Promise.all([
        provider.callContract({
          contractAddress: HELPER,
          entrypoint: "get_started",
          calldata: [commitment],
        }),
        provider.callContract({
          contractAddress: HELPER,
          entrypoint: "get_expiry",
          calldata: [commitment],
        }),
        provider.callContract({
          contractAddress: HELPER,
          entrypoint: "get_offer",
          calldata: [commitment],
        }),
        provider.callContract({
          contractAddress: HELPER,
          entrypoint: "get_note",
          calldata: [commitment],
        }),
      ]);
      const started = Number(num.toBigInt(startedResult[0] ?? "0x0"));
      const expiry = Number(num.toBigInt(expiryResult[0] ?? "0x0"));
      const offer = num.toHex(offerResult[0] ?? "0x0");
      const note = num.toHex(noteResult[0] ?? "0x0");
      setAccessResult(
        expiry > Math.floor(Date.now() / 1000)
          ? `Access active for ${Math.round((expiry - started) / 86_400)} days, until ${new Date(expiry * 1000).toLocaleString()}. Offer ${compact(offer)} · note ${compact(note)}.`
          : "No active membership matches this pass secret.",
      );
    } catch (error) {
      setAccessResult(error instanceof Error ? error.message : String(error));
    }
  }

  async function copySecret() {
    if (pass) await navigator.clipboard.writeText(pass.secret);
  }

  return (
    <main>
      <div className="grain" aria-hidden="true" />
      <nav className="nav">
        <a className="wordmark" href="#top" aria-label="Veilpass home">
          VEIL<span>/</span>PASS
        </a>
        <button className="walletButton" onClick={() => setWalletPicker(true)}>
          {address ? compact(address) : "Connect privacy wallet"}
        </button>
      </nav>

      <section className="hero" id="top">
        <div className="eyebrow">STRK20 PRIVATE CREATOR MEMBERSHIP / 01</div>
        <h1>
          Support the work.
          <br />
          <em>Keep your wallet out of it.</em>
        </h1>
        <p className="heroCopy">
          Veilpass converts a shielded STRK payment into a creator note and a fixed-term access
          commitment. The creator never sees the subscriber&apos;s public wallet.
        </p>
        <div className="truthStrip">
          <span>PUBLIC</span> helper, token, amount, time, opaque commitments
          <span>HIDDEN</span> subscriber wallet, private balance, creator link
        </div>
      </section>

      <section className="workbench" aria-label="Create a private membership">
        <div className="ticketLabel">
          <span>MEMBERSHIP INTAKE</span>
          <b>№ 0001</b>
        </div>
        <div className="formPanel">
          <div className={`offerState ${offerLocked ? "offerState-loaded" : ""}`}>
            <b>{offerLocked ? "Creator offer loaded" : "Creator setup"}</b>
            <span>
              {offerLocked
                ? "The recipient, price, and term are fixed by this link."
                : "Choose the terms and create a private offer link for a subscriber."}
            </span>
            {offerLocked && <a href="./">Create another offer</a>}
          </div>
          <label>
            Creator&apos;s registered privacy address
            <input value={creator} onChange={(event) => setCreator(event.target.value)} placeholder="0x…" disabled={offerLocked} />
          </label>
          <div className="fieldPair">
            <label>
              Payment
              <div className="amountField">
                <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" disabled={offerLocked} />
                <span>STRK</span>
              </div>
            </label>
            <label>
              Access term
              <select value={days} onChange={(event) => setDays(Number(event.target.value))} disabled={offerLocked}>
                <option value={7}>7 days</option>
                <option value={30}>30 days</option>
                <option value={90}>90 days</option>
                <option value={365}>365 days</option>
              </select>
            </label>
          </div>
          {!offerLocked && (
            <div className="offerTools">
              <button className="offerButton" onClick={createOffer}>Copy creator offer link</button>
              {offerLink && <a href={offerLink}>Open subscriber view</a>}
              <p role="status">{offerStatus || "No payment is prepared while creating an offer."}</p>
            </div>
          )}
          {offerLocked && <p className="offerNotice" role="status">{offerStatus}</p>}
          <button
            className="joinButton"
            onClick={join}
            disabled={!offerLocked || tx.kind === "proving" || tx.kind === "submitted"}
          >
            {!offerLocked ? "Create an offer first" : address ? "Create private membership" : "Connect and continue"}
            <span>↗</span>
          </button>
          <div className={`status status-${tx.kind}`} role="status">
            {tx.kind === "idle" && "No transaction is prepared until you confirm."}
            {tx.kind === "proving" && tx.detail}
            {tx.kind === "submitted" && <>Submitted: <a href={`https://voyager.online/tx/${tx.hash}`} target="_blank" rel="noreferrer">{compact(tx.hash)}</a></>}
            {tx.kind === "confirmed" && <>Confirmed: <a href={`https://voyager.online/tx/${tx.hash}`} target="_blank" rel="noreferrer">{compact(tx.hash)}</a></>}
            {tx.kind === "error" && tx.detail}
          </div>
        </div>
        <aside className="routePanel">
          <div className="routeNumber">03</div>
          <h2>One proof.<br />Three actions.</h2>
          <ol>
            <li><b>Withdraw</b><span>shielded balance → shared helper</span></li>
            <li><b>Open note</b><span>creator receives the payment privately</span></li>
            <li><b>Invoke</b><span>offer, pass, note, and expiry bound atomically</span></li>
          </ol>
          <p>The wallet owns the viewing key and builds the proof. Veilpass never receives either.</p>
        </aside>
      </section>

      <section className="passSection">
        <div>
          <div className="eyebrow">BEARER ACCESS / KEEP LOCAL</div>
          <h2>The public chain sees commitments.<br />You keep the secret.</h2>
          <p>
            A real publisher would verify the secret server-side before returning protected media.
            This demo verifies the entitlement only; it does not claim static browser assets are private.
          </p>
        </div>
        <div className="passCard">
          <div className="passCut">PRIVATE MEMBER</div>
          <code>{pass ? compact(pass.secret) : "created after confirmation"}</code>
          {pass && <small>offer {compact(pass.offerCommitment)}</small>}
          <button onClick={copySecret} disabled={!pass}>Copy pass secret</button>
        </div>
        <div className="verifyBox">
          <label>
            Verify a pass secret
            <input value={passInput} onChange={(event) => setPassInput(event.target.value)} placeholder="0x…" />
          </label>
          <button onClick={verifyAccess}>Check access</button>
          <p role="status">{accessResult || "Hash locally, then read the expiry from Starknet."}</p>
        </div>
      </section>

      <footer>
        <span>VEILPASS / PREPAID MEMBERSHIP MVP</span>
        <a href="https://strk20.starknet.io/hackathon" target="_blank" rel="noreferrer">Private Sprint 2026 ↗</a>
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
                  <img src={wallet.icon} alt="" />
                  <span>{wallet.name}</span>
                  <b>→</b>
                </button>
              )) : <div className="noWallet">No compatible wallet detected. Install Ready or Xverse, then reload.</div>}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
