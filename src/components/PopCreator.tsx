import { useEffect, useState } from "react";
import { createPop, fetchPops, type Pop } from "../lib/pop";

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
      <CreatePopForm
        onCreated={(pop) => setPops((prev) => [pop, ...(prev ?? [])])}
      />
      <PopList pops={pops ?? []} loading={loading} />
    </div>
  );
}

function CreatePopForm({ onCreated }: { onCreated: (pop: Pop) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim().length > 0 && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const pop = await createPop({
        name: name.trim(),
        description: description.trim(),
      });
      onCreated(pop);
      setName("");
      setDescription("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create Pop.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6"
    >
      <h2 className="text-lg font-semibold">Create a Pop</h2>

      <label className="block space-y-1.5">
        <span className="text-sm text-neutral-400">Event name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Sarah & Tom's Wedding"
          maxLength={120}
          className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-500"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm text-neutral-400">Description</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Leave us a note from the big day."
          rows={3}
          maxLength={1000}
          className="w-full resize-y rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-500"
        />
      </label>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={!canSubmit}
        className="rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitting ? "Publishing…" : "Create Pop"}
      </button>
    </form>
  );
}

function PopList({ pops, loading }: { pops: Pop[]; loading: boolean }) {
  if (loading) {
    return <p className="text-sm text-neutral-500">Loading your Pops…</p>;
  }
  if (pops.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        No Pops yet. Create your first one above.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Your Pops</h2>
      <ul className="space-y-3">
        {pops.map((pop) => (
          <li
            key={pop.id}
            className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4"
          >
            <h3 className="font-medium">{pop.name}</h3>
            {pop.description && (
              <p className="mt-1 text-sm text-neutral-400">{pop.description}</p>
            )}
            <CopyNaddr naddr={pop.naddr} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function CopyNaddr({ naddr }: { naddr: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(naddr);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="mt-3 truncate font-mono text-xs text-neutral-500 transition hover:text-neutral-300"
      title="Copy shareable naddr"
    >
      {copied ? "Copied!" : `${naddr.slice(0, 24)}…`}
    </button>
  );
}
