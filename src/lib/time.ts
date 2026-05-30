// Relative timestamp shared by both card renderers (canvas texture + DOM) so the
// two can never drift. Anchored to the real wall clock now that cards render
// live Nostr created_at values.
export function formatRelative(createdAt: number): string {
  const now = Math.floor(Date.now() / 1000);
  const d = Math.max(0, now - createdAt);
  if (d < 3600) return `${Math.floor(d / 60)}m`;
  if (d < 86400) return `${Math.floor(d / 3600)}h`;
  return `${Math.floor(d / 86400)}d`;
}
