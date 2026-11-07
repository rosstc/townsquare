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
 * suspense. Everyone else is revealed first, in random order.
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
  if (!aliveEvil || singleEvilDeath) {
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
