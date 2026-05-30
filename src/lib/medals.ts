// Top-zapper medals. A guestbook ranks patrons by total sats zapped; the top
// three earn gold slash marks — /// 1st, // 2nd, / 3rd. Both card renderers
// (WebGL texture + DOM) and the layout read from here so the podium can never
// disagree.

/** Number of slash marks for a medal rank (1->3, 2->2, 3->1; 0 = none). */
export function slashesForRank(medal: number): number {
  return medal >= 1 && medal <= 3 ? 4 - medal : 0;
}

/**
 * Award medals by sats *amount*, so ties share a place: the three highest
 * distinct totals are medal 1/2/3 and every zapper at one of those totals gets
 * that medal. Returns author hex pubkey -> medal rank (1, 2, or 3). Two people
 * tied at the top both get 1st; a tie can also mean a place simply isn't filled.
 */
export function medalRanks(zappedSats: Map<string, number>): Map<string, number> {
  const patrons = [...zappedSats.entries()].filter(([, sats]) => sats > 0);
  const podium = [...new Set(patrons.map(([, sats]) => sats))]
    .sort((a, b) => b - a)
    .slice(0, 3);
  const medalForTotal = new Map(podium.map((sats, i) => [sats, i + 1]));

  const medals = new Map<string, number>();
  for (const [pubkey, sats] of patrons) {
    const medal = medalForTotal.get(sats);
    if (medal) medals.set(pubkey, medal);
  }
  return medals;
}
