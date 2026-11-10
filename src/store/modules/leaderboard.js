import { leaderboardStandings } from "@/utils/oneNight";

/**
 * One Night Clocktower session leaderboard.
 *
 * Every game played in one hosted session (an evening) is kept separately, so
 * the ST can remove a game, and revealing a game again replaces its points
 * instead of adding them twice. Totals are always derived from the games.
 *
 * The ST's browser owns this state and saves it locally (persistence.js).
 * Players are sent a read-only copy, and keep the last non-empty one so a new
 * host can recover the scores (Recover scores).
 */
const sameBoard = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const state = () => ({
  // { id, time, winningTeam, scores: { [playerId]: { name, points } } }
  games: [],
  // the game being played now; Send Characters moves on once it's banked
  currentGameId: 1,
  // players: the last non-empty leaderboard received, kept for recovery
  copy: null,
  // ST: distinct copies sent back by players during Recover scores
  recovered: [],
  isRecovering: false
});

const getters = {
  standings: state => leaderboardStandings(state.games),
  /** The leaderboard as sent to players and saved. */
  board: ({ games, currentGameId }) => ({ games, currentGameId })
};

const mutations = {
  /**
   * Send Characters: a new game starts. Pressing it again before the game is
   * banked (e.g. to fix a character) keeps the same game.
   */
  startGame(state) {
    if (state.games.some(game => game.id === state.currentGameId)) {
      state.currentGameId++;
    }
  },
  /**
   * Reveal Grimoire: record the current game's points, replacing any earlier
   * reveal of the same game.
   */
  bankGame(state, { winningTeam, scores, time }) {
    const game = { id: state.currentGameId, time, winningTeam, scores };
    const index = state.games.findIndex(({ id }) => id === game.id);
    if (index >= 0) {
      state.games.splice(index, 1, game);
    } else {
      state.games.push(game);
    }
  },
  removeGame(state, id) {
    state.games = state.games.filter(game => game.id !== id);
  },
  reset(state) {
    state.games = [];
    state.currentGameId = 1;
  },
  /** Restore a saved or recovered leaderboard (ST). */
  set(state, { games = [], currentGameId = 1 } = {}) {
    state.games = games;
    state.currentGameId = currentGameId;
  },
  /**
   * Players: show the leaderboard the ST sent. An empty one (a reset, or a
   * new host who hasn't recovered yet) never replaces the copy kept for
   * recovery.
   */
  receive(state, { games = [], currentGameId = 1 } = {}) {
    state.games = games;
    state.currentGameId = currentGameId;
    if (games.length) state.copy = { games, currentGameId };
  },
  setCopy(state, copy) {
    state.copy = copy || null;
  },
  /** ST: ask connected players for their copies (Recover scores). */
  requestCopies(state) {
    state.recovered = [];
    state.isRecovering = true;
  },
  /** ST: a player's copy arrived; identical copies are grouped. */
  addRecovered(state, { name, board }) {
    if (!state.isRecovering) return;
    if (!board || !board.games || !board.games.length) return;
    const match = state.recovered.find(copy => sameBoard(copy.board, board));
    if (match) {
      match.from.push(name);
    } else {
      state.recovered.push({ board, from: [name] });
    }
  },
  stopRecovering(state) {
    state.recovered = [];
    state.isRecovering = false;
  }
};

export default {
  namespaced: true,
  state,
  getters,
  mutations
};
