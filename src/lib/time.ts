// Relative timestamp shared by both card renderers (canvas texture + DOM) so the
// two can never drift. The prototype anchors to a fixed epoch for stable mock
// output; swap NOW for Date.now()/1000 when wiring real Nostr created_at values.
const NOW = 1_750_000_000;

export function formatRelative(createdAt: number): string {
  const d = Math.max(0, NOW - createdAt);
  if (d < 3600) return `${Math.floor(d / 60)}m`;
  if (d < 86400) return `${Math.floor(d / 3600)}h`;
  return `${Math.floor(d / 86400)}d`;
}
