import { effectiveAlignment } from "@/utils/alignment";

const shuffle = (arr, random) =>
  arr
    .map(value => [random(), value])
    .sort((a, b) => a[0] - b[0])
    .map(([, value]) => value);

/**
 * One Night Clocktower always has exactly 1 base Outsider, regardless of
 * player count. Any difference from the standard setup moves to Townsfolk.
 * Setup modifiers (e.g. Baron) are applied by the ST on top of this.
 *
 * @param {{ townsfolk: number, outsider: number, minion: number, demon: number }} base
 * @returns the adjusted composition (or the input unchanged if falsy)
 */
export function oneNightComposition(base) {
  if (!base) return base;
  return {
    ...base,
    townsfolk: base.townsfolk + base.outsider - 1,
    outsider: 1
  };
}

/**
 * True when the player's death wins the game for good:
 * a Minion or Demon character that is evil.
 * An evil Goon or the Recluse does not count.
 */
export function isEvilMinionOrDemon(player) {
  if (!player || !player.role) return false;
  return (
    ["minion", "demon"].includes(player.role.team) &&
    effectiveAlignment(player) === "evil"
  );
}

/**
 * Suggested winning team after an execution.
 * @param players full player list
 * @param executedIndices indices of the executed player(s)
 * @returns {"good"|"evil"}
 */
export function suggestedWinner(players, executedIndices) {
  return executedIndices.some(i => isEvilMinionOrDemon(players[i]))
    ? "good"
    : "evil";
}

/**
 * Points for each player under the One Night Clocktower scoring rules.
 *
 * | Outcome   | Evil | Good, voted for evil | Good, did not |
 * | Evil wins |  3   |          1           |       0       |
 * | Good wins |  0   |          3           |       1       |
 *
 * "Evil" is each player's alignment at game end (ST override, else role team).
 * With no vote (votes === null) nobody voted for evil, so only the
 * non-vote points apply.
 *
 * @param players full player list
 * @param {"good"|"evil"} winningTeam
 * @param {Object<number, number>|null} votes { voterIndex: targetIndex }
 * @returns {Array<number|null>} points per player, null for players with no alignment
 */
export function oneNightPoints(players, winningTeam, votes) {
  const alignments = players.map(effectiveAlignment);
  return players.map((player, i) => {
    const alignment = alignments[i];
    if (!alignment) return null;
    if (alignment === "evil") return winningTeam === "evil" ? 3 : 0;
    const target = votes ? votes[i] : undefined;
    const votedEvil =
      target !== undefined && target !== null && alignments[target] === "evil";
    if (winningTeam === "evil") return votedEvil ? 1 : 0;
    return votedEvil ? 3 : 1;
  });
}

const isDemon = player => !!player.role && player.role.team === "demon";

/**
 * Grimoire Reveal order for a One Night game.
 *
 * The final shake & reveal group holds every Demon plus every dead player
 * (the executed, or anyone killed during the day). One random living good
 * player joins the group if no evil player is left alive, or if the only
 * death was a single evil Minion or Demon, so the final reveal still has
 * suspense. If nobody died (rare), the group is the Demon, one other random
 * evil player and one random good player. Everyone else is revealed first,
 * in random order.
 *
 * @param players snapshot players ({ role, alignment, isDead })
 * @param random RNG, injectable for tests
 * @returns {{ revealOrder: number[], finalThree: boolean, finalPair: number[] }|null}
 *   null when there is no meaningful group; use the standard order instead
 */
export function oneNightRevealOrder(players, random = Math.random) {
  const indices = players.map((_, i) => i);
  const group = indices.filter(i => players[i].isDead || isDemon(players[i]));

  const aliveEvil = indices.some(
    i => !players[i].isDead && effectiveAlignment(players[i]) === "evil"
  );
  const deaths = indices.filter(i => players[i].isDead);
  const singleEvilDeath =
    deaths.length === 1 && isEvilMinionOrDemon(players[deaths[0]]);
  const pickOne = alignment => {
    const candidates = indices.filter(
      i => !group.includes(i) && effectiveAlignment(players[i]) === alignment
    );
    if (candidates.length) group.push(shuffle(candidates, random)[0]);
  };
  if (!deaths.length) {
    // nobody died: the Demon, one other evil player and one good player
    // (with no Demon either, there's nothing to build on: standard order)
    if (group.length) {
      pickOne("evil");
      pickOne("good");
    }
  } else if (!aliveEvil || singleEvilDeath) {
    const aliveGood = indices.filter(
      i =>
        !group.includes(i) &&
        !players[i].isDead &&
        effectiveAlignment(players[i]) === "good"
    );
    if (aliveGood.length) group.push(shuffle(aliveGood, random)[0]);
  }

  // The main reveal needs at least one player, otherwise the final group
  // never triggers (e.g. an all-way tie where everyone was executed).
  if (group.length && group.length >= players.length) {
    const nonDemons = group.filter(i => !isDemon(players[i]));
    const moved = shuffle(nonDemons.length ? nonDemons : group, random)[0];
    group.splice(group.indexOf(moved), 1);
  }
  if (!group.length) return null;

  return {
    revealOrder: shuffle(
      indices.filter(i => !group.includes(i)),
      random
    ),
    finalThree: true,
    finalPair: shuffle(group, random)
  };
}

/**
 * Order in which a Secret Point Vote is revealed: clockwise round the
 * circle from the first seat, every seated player in turn, including those
 * who didn't vote. Empty seats are skipped.
 *
 * @param players full player list (seated players have an id)
 * @param votes { voterIndex: targetIndex }
 * @returns {number[]} player indices, one per reveal step
 */
export function clockwiseVoteRevealOrder(players, votes) {
  return players
    .map((player, i) => i)
    .filter(i => players[i].id || votes[i] !== undefined);
}

/** One Night Clocktower rules, shown on the Night Order sheet. */
export const ONE_NIGHT_RULES = [
  "There is only one night and one day.",
  "Good wins immediately if an evil Minion or Demon dies.",
  "Evil wins after Day 1.",
  "No private chats & no nominations.",
  "At the end of Day 1, everyone secretly votes for one player (can be themselves).",
  "The player with the most votes is executed. In a tie, all players with tied votes against them are executed.",
  "If both teams would win at once, good wins.",
  "There is always 1 Outsider (before any setup changes)."
];

/**
 * Scoring rules by winning team, as shown to players. Must match
 * oneNightPoints (a test keeps them in step). Unlisted players score 0.
 */
export const ONE_NIGHT_SCORING = {
  evil: [
    { points: 3, who: "Every evil player" },
    { points: 1, who: "Good players who voted for an evil player" }
  ],
  good: [
    { points: 3, who: "Good players who voted for an evil player" },
    { points: 1, who: "Every other good player" }
  ]
};

/**
 * Who a player is on the session leaderboard. Seated players are tracked by
 * the browser that claimed their seat, so they keep their score through seat
 * moves and renames. Players without a seat (no browser of their own) still
 * score, tracked by their seat name. A seat with no name has nobody to track.
 *
 * @returns {string} the key, or "" when the player can't be tracked
 */
export function leaderboardKey(player) {
  if (player.id) return player.id;
  return player.name ? `name:${player.name}` : "";
}

/**
 * Ranks for rows already sorted highest first. Tied scores share a rank and
 * the next score takes the next number, with no gaps:
 * 6, 6, 3, 3, 0 → 1, 1, 2, 2, 3.
 *
 * @returns {number[]} one rank per row, in the same order
 */
const rankBy = (sorted, scoreOf) => {
  let rank = 0;
  return sorted.map((row, i) => {
    if (i === 0 || scoreOf(row) !== scoreOf(sorted[i - 1])) rank++;
    return rank;
  });
};

/**
 * Running totals for the session leaderboard, highest first.
 * Tied players share a rank, with no gaps (1, 1, 2); ties are listed by
 * name. Each player
 * shows the most recent name they played under.
 *
 * @param games leaderboard games ({ id, scores: { [playerId]: { name, points } } })
 * @returns {Array<{ id: string, name: string, total: number, games: number, rank: number }>}
 */
export function leaderboardStandings(games) {
  const byPlayer = {};
  [...games]
    .sort((a, b) => a.id - b.id)
    .forEach(game => {
      Object.entries(game.scores).forEach(([id, { name, points }]) => {
        if (!byPlayer[id]) byPlayer[id] = { id, name, total: 0, games: 0 };
        const row = byPlayer[id];
        row.name = name;
        row.total += points;
        row.games++;
      });
    });
  const rows = Object.values(byPlayer).sort(
    (a, b) => b.total - a.total || String(a.name).localeCompare(b.name)
  );
  rankBy(rows, row => row.total).forEach((rank, i) => {
    rows[i].rank = rank;
  });
  return rows;
}

/**
 * Leaderboard rows for the Grimoire Reveal: each player's total before this
 * game, what they gained in it, and their new total, with a rank for both.
 * Rows come ordered by the new standings.
 *
 * @param games leaderboard games, including the game just revealed
 * @param gameId the game just revealed
 */
export function leaderboardRevealRows(games, gameId) {
  const after = leaderboardStandings(games);
  const before = leaderboardStandings(games.filter(g => g.id !== gameId));
  const current = games.find(g => g.id === gameId);
  const rows = after.map(row => {
    const was = before.find(b => b.id === row.id);
    const scored = current && current.scores[row.id];
    return {
      id: row.id,
      name: row.name,
      before: was ? was.total : 0,
      gained: scored ? scored.points : 0,
      total: row.total,
      rank: row.rank
    };
  });
  // rank the earlier standings too, new players included at 0
  const byBefore = [...rows].sort(
    (a, b) => b.before - a.before || String(a.name).localeCompare(b.name)
  );
  rankBy(byBefore, row => row.before).forEach((rank, i) => {
    byBefore[i].beforeRank = rank;
  });
  return rows;
}
