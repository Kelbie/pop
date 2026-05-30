import type { NDKEvent, NDKUserProfile } from "@nostr-dev-kit/ndk";
import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { DonorRow } from "./DonorRow";
import { useDonations } from "../hooks/useDonations";
import { connectNdk, ndk } from "../lib/ndk";
import {
  buildSignedZapRequest,
  fetchZapInvoice,
  lightningAddress,
} from "../lib/npubcash";
import { shortNpub } from "../lib/pubkey";

const fmt = new Intl.NumberFormat("en-US");
const PRESETS = [21, 100, 1000, 5000];

/**
 * The host's profile + Lightning zap surface: avatar, name, address QR, running
 * total (npub.cash), a zap box, and the recent-donor list. Shown above the
 * guestbook canvas on the unified event page.
 */
export function DonationPanel({
  hex,
  npub,
  title,
  description,
}: {
  hex: string;
  npub: string;
  title?: string;
  description?: string;
}) {
  const [profile, setProfile] = useState<NDKUserProfile | null>(null);
  const { totalSats, count, donations, loading } = useDonations(hex);
  const address = lightningAddress(npub);

  useEffect(() => {
    let cancelled = false;
    connectNdk().then(() =>
      ndk
        .getUser({ pubkey: hex })
        .fetchProfile()
        .then((p) => !cancelled && setProfile(p))
        .catch(() => {}),
    );
    return () => {
      cancelled = true;
    };
  }, [hex]);

  const displayName = profile?.displayName || profile?.name || shortNpub(hex);
  const avatar = profile?.picture || profile?.image;

  return (
    <div className="mx-auto max-w-xl px-6 py-10">
      {/* Recipient + address QR */}
      <div className="flex flex-col items-center text-center">
        {avatar ? (
          <img
            src={avatar}
            alt=""
            className="h-20 w-20 rounded-full object-cover ring-2 ring-neutral-200"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-indigo-600 text-2xl font-bold text-white">
            {displayName.slice(0, 1).toUpperCase()}
          </div>
        )}
        {title && <h1 className="mt-4 text-2xl font-bold">{title}</h1>}
        <p className={"text-neutral-500 " + (title ? "mt-1 text-sm" : "mt-4 text-2xl font-bold text-neutral-900")}>
          {title ? `Hosted by ${displayName}` : displayName}
        </p>
        {description && (
          <p className="mt-2 max-w-md text-sm text-neutral-500">{description}</p>
        )}

        <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-4">
          <QRCodeSVG value={`lightning:${address}`} size={208} />
        </div>
        <CopyAddress address={address} />
      </div>

      {/* Running total */}
      <div className="mt-8 rounded-2xl border border-neutral-200 bg-white px-6 py-6 text-center">
        <div className="text-sm uppercase tracking-wide text-neutral-500">
          Total received
        </div>
        <div className="mt-1 font-mono text-4xl font-bold text-amber-500">
          {fmt.format(Math.round(totalSats))}
          <span className="ml-2 text-lg text-neutral-400">sats</span>
        </div>
        <div className="mt-1 text-sm text-neutral-500">
          {loading
            ? "Loading zaps…"
            : `from ${count} zap${count === 1 ? "" : "s"}`}
        </div>
      </div>

      {/* Zap flow */}
      <ZapBox hex={hex} npub={npub} />

      {/* Donor list */}
      {donations.length > 0 && (
        <div className="mt-8 space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Recent donations
          </h2>
          {donations.map((d) => (
            <DonorRow key={d.id} donation={d} />
          ))}
        </div>
      )}

      <p className="mt-8 text-center text-xs text-neutral-400">
        Only zaps appear here. A plain Lightning payment to the address won’t be
        counted — use the button above (or zap from your Nostr client).
      </p>
    </div>
  );
}

function CopyAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(address);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard unavailable */
        }
      }}
      className="mt-3 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 font-mono text-sm text-neutral-600 transition hover:text-neutral-900"
    >
      {copied ? "Copied!" : address}
    </button>
  );
}

type ZapStatus = "idle" | "loading" | "invoice" | "paid";

function ZapBox({ hex, npub }: { hex: string; npub: string }) {
  const [amount, setAmount] = useState(100);
  const [status, setStatus] = useState<ZapStatus>("idle");
  const [invoice, setInvoice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const zapRequestId = useRef<string | null>(null);

  // Watch for the receipt matching our zap request → mark paid.
  useEffect(() => {
    if (status !== "invoice" || !zapRequestId.current) return;
    let cancelled = false;
    const sub = ndk.subscribe(
      { kinds: [9735], "#p": [hex] },
      { closeOnEose: false },
    );
    sub.on("event", (event: NDKEvent) => {
      if (cancelled) return;
      const desc = event.tags.find((t) => t[0] === "description")?.[1];
      if (!desc) return;
      try {
        if (JSON.parse(desc).id === zapRequestId.current) {
          setStatus("paid");
        }
      } catch {
        /* ignore unparseable */
      }
    });
    return () => {
      cancelled = true;
      sub.stop();
    };
  }, [status, hex]);

  const startZap = async () => {
    if (amount <= 0) return;
    setError(null);
    setStatus("loading");
    try {
      const { signed, id } = await buildSignedZapRequest({
        recipientHex: hex,
        msats: amount * 1000,
      });
      zapRequestId.current = id;
      const pr = await fetchZapInvoice(npub, amount * 1000, signed);
      setInvoice(pr);
      setStatus("invoice");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create invoice.");
      setStatus("idle");
    }
  };

  const reset = () => {
    setStatus("idle");
    setInvoice(null);
    setError(null);
    zapRequestId.current = null;
  };

  if (status === "paid") {
    return (
      <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 px-6 py-8 text-center">
        <div className="text-3xl">⚡️</div>
        <h2 className="mt-2 text-xl font-bold text-green-700">Thank you!</h2>
        <p className="mt-1 text-sm text-green-600">
          Your {fmt.format(amount)} sat zap was received.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 rounded-xl border border-green-300 px-4 py-2 text-sm font-semibold text-green-700 transition hover:bg-green-100"
        >
          Zap again
        </button>
      </div>
    );
  }

  if (status === "invoice" && invoice) {
    return (
      <div className="mt-6 flex flex-col items-center rounded-2xl border border-neutral-200 bg-white px-6 py-6 text-center">
        <p className="text-sm text-neutral-600">
          Scan to pay {fmt.format(amount)} sats
        </p>
        <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4">
          <QRCodeSVG value={`lightning:${invoice}`} size={208} />
        </div>
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(invoice).catch(() => {})}
          className="mt-3 w-full truncate rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-xs text-neutral-500 transition hover:text-neutral-800"
        >
          {invoice}
        </button>
        <p className="mt-3 animate-pulse text-sm text-neutral-500">
          Waiting for payment…
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-2 text-xs text-neutral-500 hover:text-neutral-800"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-2xl border border-neutral-200 bg-white px-6 py-6">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setAmount(p)}
            className={
              "rounded-lg px-3 py-1.5 text-sm font-medium transition " +
              (amount === p
                ? "bg-amber-500 text-white"
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200")
            }
          >
            {fmt.format(p)}
          </button>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <input
          type="number"
          min={1}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          className="w-32 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-amber-500"
        />
        <span className="text-sm text-neutral-500">sats</span>
      </div>
      <button
        type="button"
        onClick={startZap}
        disabled={status === "loading" || amount <= 0}
        className="mt-4 w-full rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {status === "loading" ? "Creating invoice…" : `⚡️ Zap ${fmt.format(amount)} sats`}
      </button>
      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
    </div>
  );
}
