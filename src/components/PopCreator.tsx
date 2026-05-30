import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPop, fetchPops, type Pop } from "../lib/pop";
import { ImageCropField } from "./ImageCropField";

export function PopCreator({ host }: { host: string }) {
  const [pops, setPops] = useState<Pop[] | null>(null);

  useEffect(() => {
    let active = true;
    fetchPops(host).then((list) => {
      if (active) setPops(list);
    });
    return () => {
      active = false;
    };
  }, [host]);

  const loading = pops === null;

  return (
    <div className="w-full max-w-xl space-y-8">
      <CreatePopForm />
      <PopList pops={pops ?? []} loading={loading} />
    </div>
  );
}

function CreatePopForm() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [picture, setPicture] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [uploading, setUploading] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim().length > 0 && uploading === 0 && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const pop = await createPop({
        name: name.trim(),
        description: description.trim(),
        picture: picture ?? undefined,
        banner: banner ?? undefined,
      });
      navigate(`/e/${pop.nevent}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create Pop.");
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-2xl border border-hairline bg-polaroid p-6 shadow-[0_8px_28px_rgba(36,30,26,0.10)]"
    >
      <h2 className="text-lg font-semibold text-ink">Create a Pop</h2>

      <label className="block space-y-1.5">
        <span className="text-sm text-muted">Event name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Sarah & Tom's Wedding"
          maxLength={120}
          className="w-full rounded-lg border border-hairline bg-polaroid px-3 py-2 text-sm text-ink outline-none placeholder:text-muted focus:border-ink"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm text-muted">Description</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Leave us a note from the big day."
          rows={3}
          maxLength={1000}
          className="w-full resize-y rounded-lg border border-hairline bg-polaroid px-3 py-2 text-sm text-ink outline-none placeholder:text-muted focus:border-ink"
        />
      </label>

      <ImageCropField
        label="Cover picture"
        aspect={1}
        value={picture}
        onChange={setPicture}
        onUploadingChange={(up) => setUploading((n) => n + (up ? 1 : -1))}
      />

      <ImageCropField
        label="Banner"
        aspect={4 / 3}
        value={banner}
        onChange={setBanner}
        onUploadingChange={(up) => setUploading((n) => n + (up ? 1 : -1))}
      />

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={!canSubmit}
        className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-polaroid transition hover:bg-avatar-ink active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40 disabled:active:translate-y-0"
      >
        {submitting ? "Publishing…" : "Create Pop"}
      </button>
    </form>
  );
}

function PopList({ pops, loading }: { pops: Pop[]; loading: boolean }) {
  if (loading) {
    return <p className="text-sm text-muted">Loading your Pops…</p>;
  }
  if (pops.length === 0) {
    return (
      <p className="text-sm text-muted">
        No Pops yet. Create your first one above.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-ink">Your Pops</h2>
      <ul className="space-y-3">
        {pops.map((pop) => (
          <li
            key={pop.id}
            className="rounded-xl border border-hairline bg-polaroid p-4 shadow-sm transition hover:shadow-[0_8px_28px_rgba(36,30,26,0.10)]"
          >
            <Link to={`/e/${pop.nevent}`} className="flex items-start gap-3">
              {pop.picture && (
                <img
                  src={pop.picture}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-lg object-cover"
                />
              )}
              <div className="min-w-0">
                <h3 className="font-medium text-ink hover:underline">{pop.name}</h3>
                {pop.description && (
                  <p className="mt-1 text-sm text-muted">
                    {pop.description}
                  </p>
                )}
              </div>
            </Link>
            <CopyLink nevent={pop.nevent} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function CopyLink({ nevent }: { nevent: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/e/${nevent}`;
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="mt-3 truncate font-mono text-xs text-muted transition hover:text-ink"
      title="Copy shareable link"
    >
      {copied ? "Copied!" : `${nevent.slice(0, 24)}…`}
    </button>
  );
}
