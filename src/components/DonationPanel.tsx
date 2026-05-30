import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { DonorRow } from "./DonorRow";
import { useDonations } from "../hooks/useDonations";
import { useProfile } from "../hooks/useProfile";
import { ndk } from "../lib/ndk";
import { buildSignedZapRequest, fetchZapInvoice } from "../lib/npubcash";

const fmt = new Intl.NumberFormat("en-US");
const PRESETS = [21, 100, 1000, 5000];

/**
 * The host's profile + Lightning zap surface: avatar, name, address QR, running
 * total (npub.cash), a zap box, and the recent-donor list. Rendered inside the
 * Zap modal on the event page. Warm-neutral throughout; flash-gold is reserved
 * for the actual zap-send action and the invoice step (DESIGN.md: a moment, not
 * a surface).
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
  const { totalSats, count, donations, loading } = useDonations(hex);
  const { displayName, avatar } = useProfile(hex);

  return (
    <div>
      {/* Recipient */}
      <div className="flex flex-col items-center text-center">
        {avatar ? (
          <img
            src={avatar}
            alt=""
            className="h-20 w-20 rounded-full object-cover ring-2 ring-hairline"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-avatar text-2xl font-bold text-avatar-ink">
            {displayName.slice(0, 1).toUpperCase()}
          </div>
        )}
        {title && <h1 className="mt-4 text-2xl font-bold text-ink">{title}</h1>}
        <p className={title ? "mt-1 text-sm text-muted" : "mt-4 text-2xl font-bold text-ink"}>
          {title ? `Hosted by ${displayName}` : displayName}
        </p>
        {description && (
          <p className="mt-2 max-w-md text-sm text-muted">{description}</p>
        )}
      </div>

      {/* Running total */}
      <div className="mt-8 rounded-2xl border border-hairline bg-paper px-6 py-6 text-center">
        <div className="text-sm uppercase tracking-wide text-muted">
          Total received
        </div>
        <div className="mt-1 font-mono text-4xl font-bold text-ink">
          {fmt.format(Math.round(totalSats))}
          <span className="ml-2 text-lg text-muted">sats</span>
        </div>
        <div className="mt-1 text-sm text-muted">
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
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Recent donations
          </h2>
          {donations.map((d) => (
            <DonorRow key={d.id} donation={d} />
          ))}
        </div>
      )}

      <p className="mt-8 text-center text-xs text-muted">
        Only zaps appear here. A plain Lightning payment to the address won’t be
        counted — use the button above (or zap from your Nostr client).
      </p>
    </div>
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
      <div className="mt-6 rounded-2xl border border-flash/50 bg-flash/10 px-6 py-8 text-center">
        <div className="text-3xl">⚡️</div>
        <h2 className="mt-2 text-xl font-bold text-ink">Thank you!</h2>
        <p className="mt-1 text-sm text-muted">
          Your {fmt.format(amount)} sat zap was received.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 rounded-xl border border-hairline bg-polaroid px-4 py-2 text-sm font-semibold text-ink transition hover:bg-paper"
        >
          Zap again
        </button>
      </div>
    );
  }

  if (status === "invoice" && invoice) {
    return (
      <div className="mt-6 flex flex-col items-center rounded-2xl border border-hairline bg-paper px-6 py-6 text-center">
        <p className="text-sm text-muted">
          Scan to pay {fmt.format(amount)} sats
        </p>
        <div className="mt-4 rounded-2xl border border-flash/50 bg-white p-4">
          <QRCodeSVG value={`lightning:${invoice}`} size={208} />
        </div>
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(invoice).catch(() => {})}
          className="mt-3 w-full truncate rounded-lg border border-hairline bg-polaroid px-3 py-2 font-mono text-xs text-muted transition hover:text-ink"
        >
          {invoice}
        </button>
        <p className="mt-3 animate-pulse text-sm text-muted">
          Waiting for payment…
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-2 text-xs text-muted hover:text-ink"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-2xl border border-hairline bg-paper px-6 py-6">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setAmount(p)}
            className={
              "rounded-lg px-3 py-1.5 text-sm font-medium transition " +
              (amount === p
                ? "bg-ink text-polaroid"
                : "bg-polaroid text-muted hover:bg-hairline")
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
          className="w-32 rounded-lg border border-hairline bg-polaroid px-3 py-2 text-sm text-ink outline-none focus:border-ink"
        />
        <span className="text-sm text-muted">sats</span>
      </div>
      <button
        type="button"
        onClick={startZap}
        disabled={status === "loading" || amount <= 0}
        className="mt-4 w-full rounded-xl bg-flash px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-flash-deep disabled:cursor-not-allowed disabled:opacity-50"
      >
        {status === "loading" ? "Creating invoice…" : `⚡️ Zap ${fmt.format(amount)} sats`}
      </button>
      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
    </div>
  );
}
