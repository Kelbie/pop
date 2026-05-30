import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { DEFAULT_NOSTRCONNECT_RELAY, useAuthStore } from "../store/auth";
import { Modal } from "./Modal";

type Tab = "extension" | "bunker" | "nsec";

const TABS: { id: Tab; label: string }[] = [
  { id: "extension", label: "Extension" },
  { id: "bunker", label: "Remote signer" },
  { id: "nsec", label: "Private key" },
];

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
}

export function LoginModal({ open, onClose }: LoginModalProps) {
  // Default to the extension tab when present, otherwise nudge toward the remote signer.
  const [tab, setTab] = useState<Tab>(() =>
    typeof window !== "undefined" && window.nostr ? "extension" : "bunker",
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Log in"
      subtitle="Sign in to Pop with your Nostr account."
    >
      <div className="mb-5 flex gap-1 rounded-xl bg-neutral-800/60 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={
              "flex-1 rounded-lg px-3 py-2 text-sm font-medium transition " +
              (tab === t.id
                ? "bg-neutral-700 text-neutral-100 shadow"
                : "text-neutral-400 hover:text-neutral-200")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "extension" && <ExtensionTab onClose={onClose} />}
      {tab === "bunker" && <BunkerTab onClose={onClose} />}
      {tab === "nsec" && <NsecTab onClose={onClose} />}
    </Modal>
  );
}

function ErrorNote({ message }: { message: string }) {
  return <p className="text-sm text-red-400">{message}</p>;
}

function PrimaryButton({
  children,
  disabled,
  onClick,
  loading,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {loading ? "Connecting…" : children}
    </button>
  );
}

function ExtensionTab({ onClose }: { onClose: () => void }) {
  const loginWithExtension = useAuthStore((s) => s.loginWithExtension);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasExtension = typeof window !== "undefined" && !!window.nostr;

  const connect = async () => {
    setError(null);
    setLoading(true);
    try {
      await loginWithExtension();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Extension login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-300">
        Sign in with one click using your browser extension. Your private key
        never leaves the extension.
      </p>
      {hasExtension ? (
        <PrimaryButton onClick={connect} loading={loading}>
          Connect extension
        </PrimaryButton>
      ) : (
        <div className="rounded-xl border border-neutral-800 bg-neutral-800/40 px-4 py-3 text-sm text-neutral-400">
          No Nostr extension detected. Install{" "}
          <a
            href="https://getalby.com"
            target="_blank"
            rel="noreferrer"
            className="text-indigo-400 hover:underline"
          >
            Alby
          </a>{" "}
          or{" "}
          <a
            href="https://github.com/fiatjaf/nos2x"
            target="_blank"
            rel="noreferrer"
            className="text-indigo-400 hover:underline"
          >
            nos2x
          </a>
          , or use another method.
        </div>
      )}
      {error && <ErrorNote message={error} />}
    </div>
  );
}

function BunkerTab({ onClose }: { onClose: () => void }) {
  const loginWithBunkerUrl = useAuthStore((s) => s.loginWithBunkerUrl);
  const startNostrConnect = useAuthStore((s) => s.startNostrConnect);

  const [uri, setUri] = useState("");
  const [relay, setRelay] = useState(DEFAULT_NOSTRCONNECT_RELAY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectUri, setConnectUri] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const connectWithUrl = async () => {
    setError(null);
    setLoading(true);
    try {
      await loginWithBunkerUrl(uri);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bunker connection failed.");
    } finally {
      setLoading(false);
    }
  };

  const generateQr = () => {
    setError(null);
    try {
      const { uri: nc, ready } = startNostrConnect(relay.trim() || undefined);
      setConnectUri(nc);
      ready
        .then(() => onClose())
        .catch((e: unknown) =>
          setError(e instanceof Error ? e.message : "Signer did not connect."),
        );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start connection.");
    }
  };

  const copyUri = async () => {
    if (!connectUri) return;
    try {
      await navigator.clipboard.writeText(connectUri);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  if (connectUri) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-neutral-300">
          Scan with your signer app (nsec.app, Amber…), or copy the connection
          string.
        </p>
        <div className="mx-auto w-fit rounded-xl bg-white p-3">
          <QRCodeSVG value={connectUri} size={196} />
        </div>
        <button
          type="button"
          onClick={copyUri}
          className="w-full truncate rounded-lg border border-neutral-800 bg-neutral-800/40 px-3 py-2 text-xs text-neutral-400 transition hover:text-neutral-200"
        >
          {copied ? "Copied!" : connectUri}
        </button>
        <p className="animate-pulse text-sm text-neutral-400">
          Waiting for signer to connect…
        </p>
        {error && <ErrorNote message={error} />}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-neutral-300">
        Connect a remote signer (nsec.app, nsecBunker, Amber). Your private key
        stays in the signer.
      </p>

      <div className="space-y-2">
        <label className="block text-xs font-medium uppercase tracking-wide text-neutral-500">
          Paste a bunker URL
        </label>
        <input
          value={uri}
          onChange={(e) => setUri(e.target.value)}
          placeholder="bunker://…"
          className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-indigo-500"
        />
        <PrimaryButton
          onClick={connectWithUrl}
          loading={loading}
          disabled={!uri.trim().startsWith("bunker://")}
        >
          Connect
        </PrimaryButton>
      </div>

      <div className="flex items-center gap-3 text-xs uppercase text-neutral-600">
        <span className="h-px flex-1 bg-neutral-800" />
        or
        <span className="h-px flex-1 bg-neutral-800" />
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-medium uppercase tracking-wide text-neutral-500">
          Connect with a QR code
        </label>
        <input
          value={relay}
          onChange={(e) => setRelay(e.target.value)}
          placeholder="wss://relay.nsec.app"
          className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-indigo-500"
        />
        <button
          type="button"
          onClick={generateQr}
          className="w-full rounded-xl border border-neutral-700 px-4 py-2.5 text-sm font-semibold text-neutral-100 transition hover:bg-neutral-800"
        >
          Generate QR code
        </button>
      </div>

      {error && <ErrorNote message={error} />}
    </div>
  );
}

function NsecTab({ onClose }: { onClose: () => void }) {
  const loginWithNsec = useAuthStore((s) => s.loginWithNsec);
  const [nsec, setNsec] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = nsec.trim().startsWith("nsec1");

  const signIn = async () => {
    setError(null);
    setLoading(true);
    try {
      await loginWithNsec(nsec);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid private key.");
    } finally {
      setLoading(false);
    }
  };

  const paste = async () => {
    try {
      setNsec(await navigator.clipboard.readText());
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
        ⚠️ Pasting your private key here is risky — any script on this page can
        read it, and a leaked nsec can never be recovered. Prefer an extension or
        remote signer. Only continue on a device you trust.
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Private key
          </label>
          <button
            type="button"
            onClick={paste}
            className="text-xs text-indigo-400 hover:underline"
          >
            Paste
          </button>
        </div>
        <input
          type="password"
          value={nsec}
          onChange={(e) => setNsec(e.target.value)}
          placeholder="nsec1…"
          autoComplete="off"
          className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-indigo-500"
        />
      </div>

      <PrimaryButton onClick={signIn} loading={loading} disabled={!valid}>
        Sign in with private key
      </PrimaryButton>

      {error && <ErrorNote message={error} />}
    </div>
  );
}
