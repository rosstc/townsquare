import Vue from "vue";

/**
 * Handle a vote request.
 * If the vote is from a seat that is already locked, ignore it.
 * @param state session state
 * @param index seat of the player in the circle
 * @param vote true or false
 */
const handleVote = (state, [index, vote]) => {
  if (!state.nomination) return;
  state.votes = [...state.votes];
  state.votes[index] = vote === undefined ? !state.votes[index] : vote;
};

const state = () => ({
  sessionId: "",
  isSpectator: false,
  isReconnecting: false,
  playerCount: 0,
  ping: 0,
  playerId: "",
  claimedSeat: -1,
  nomination: false,
  votes: [],
  lockedVote: 0,
  votingSpeed: 1000,
  isVoteInProgress: false,
  voteHistory: [],
  markedPlayer: -1,
  markedPlayers: [],
  // bumped by Remove all (Characters) on this screen only: every token
  // clears this browser's own good/evil mark (Player.vue)
  alignmentResetCount: 0,
  // a short message in the centre of the town (TownNotice.vue), this screen only
  notice: null,
  isVoteHistoryAllowed: false,
  isRolesDistributed: false,
  isNight: false,
  isHiddenVoting: false,
  isReturnToTown: false,
  isOneNight: false,
  pointVoteActive: false,
  pointVotes: {},
  pointVoteCountdown: false,
  pointVoteEnded: false,
  pointVoteRevealed: false,
  pointVoteVoters: [],
  // One Night vote reveal: voters in reveal order, and how many are shown.
  // The step is advanced locally on every client; only start/skip are synced.
  pointVoteRevealOrder: [],
  pointVoteRevealStep: 0,
  pointVoteRevealCount: 0,
  oneNightVotes: null,
  gameEnded: false,
  winningTeam: null,
  victoryCount: 0,
  victoryModalTeam: null,
  victoryRevealActive: false,
  victoryRevealSnapshot: null,
  revealCount: 0
});

/**
 * During a Secret Point Vote, players only hold their own vote until the ST
 * reveals the result, so tallies and leaders must not be shown to them.
 */
const isPointVoteHidden = state =>
  state.isOneNight && state.isSpectator && !state.pointVoteRevealed;

/**
 * One Night: true while the votes are being revealed one voter at a time.
 * The final step (order length + 1) is the result. Closing the vote panel
 * ends it too, so a client whose timer fell behind can't get stuck.
 */
const isPointVoteRevealing = state =>
  state.isOneNight &&
  state.pointVoteEnded &&
  state.pointVoteRevealed &&
  state.pointVoteRevealOrder.length > 0 &&
  state.pointVoteRevealStep <= state.pointVoteRevealOrder.length;

const pointVoteName = state =>
  state.isOneNight ? "Secret Point Vote" : "Point Vote";

/**
 * Re-key saved One Night votes ({ voter: target }) after seats change.
 * @param votes saved votes
 * @param seatOf old seat index → new seat index
 */
const remapVotes = (votes, seatOf) => {
  const remapped = {};
  Object.entries(votes).forEach(([voter, target]) => {
    remapped[seatOf(Number(voter))] = seatOf(Number(target));
  });
  return remapped;
};

const getters = {
  pointVoteName,
  pointVotesHidden: isPointVoteHidden,
  pointVoteRevealing: isPointVoteRevealing,
  /**
   * The votes that may be shown right now: during a One Night reveal only
   * the voters reached so far, otherwise every vote this client holds.
   */
  visiblePointVotes(state) {
    if (!isPointVoteRevealing(state)) return state.pointVotes;
    const shown = {};
    state.pointVoteRevealOrder
      .slice(0, state.pointVoteRevealStep)
      .forEach(voter => {
        if (state.pointVotes[voter] !== undefined) {
          shown[voter] = state.pointVotes[voter];
        }
      });
    return shown;
  },
  /** The voter currently in the spotlight during a reveal, or -1. */
  pointVoteRevealCurrent(state) {
    if (!isPointVoteRevealing(state) || state.pointVoteRevealStep < 1) {
      return -1;
    }
    return state.pointVoteRevealOrder[state.pointVoteRevealStep - 1];
  },
  /**
   * Seats that have cast a point vote. Players in a Secret Point Vote only
   * learn this list from the ST; everyone else can derive it from the votes.
   */
  pointVoteVoterIndices(state) {
    if (isPointVoteHidden(state)) return state.pointVoteVoters;
    return Object.keys(state.pointVotes).map(Number);
  },
  pointVoteLeaders(state) {
    if (isPointVoteHidden(state) || isPointVoteRevealing(state)) return [];
    const tally = {};
    for (const targetIdx of Object.values(state.pointVotes)) {
      tally[targetIdx] = (tally[targetIdx] || 0) + 1;
    }
    const max = Math.max(...Object.values(tally), 0);
    if (max === 0) return [];
    return Object.keys(tally)
      .filter(k => tally[k] === max)
      .map(Number);
  }
};

// mutations helper functions
const set = key => (state, val) => {
  state[key] = val;
};

const toggleFlag = key => (state, val) => {
  state[key] = val === true || val === false ? val : !state[key];
};

// shared vote history accessibility check
const canRecord = state => state.isVoteHistoryAllowed || !state.isSpectator;

const mutations = {
  setPlayerId: set("playerId"),
  setSpectator: set("isSpectator"),
  setReconnecting: set("isReconnecting"),
  setPlayerCount: set("playerCount"),
  setPing: set("ping"),
  setVotingSpeed: set("votingSpeed"),
  setVoteInProgress: set("isVoteInProgress"),
  /**
   * Skull-mark one player (index, or -1 for none) or several (array, for a
   * tied Point Vote). markedPlayer keeps the first mark for nomination logic.
   */
  /**
   * ST: a Rerack. Changes no state here; socket.js tells every player to
   * clear their screen.
   */
  startRerack() {},
  showNotice(state, text) {
    state.notice = { text, id: Date.now() + Math.random() };
  },
  resetSelfAlignments(state) {
    state.alignmentResetCount++;
  },
  setMarkedPlayer(state, val) {
    if (Array.isArray(val)) {
      state.markedPlayers = [...val];
      state.markedPlayer = val.length ? val[0] : -1;
    } else {
      state.markedPlayer = val;
      state.markedPlayers = val >= 0 ? [val] : [];
    }
  },
  setNomination: set("nomination"),
  setVoteHistoryAllowed: set("isVoteHistoryAllowed"),
  claimSeat: set("claimedSeat"),
  distributeRoles: set("isRolesDistributed"),
  setSessionId(state, sessionId) {
    state.sessionId = sessionId
      .toLocaleLowerCase()
      .replace(/[^0-9a-z]/g, "")
      .slice(0, 10);
  },
  nomination(
    state,
    { nomination, votes, votingSpeed, lockedVote, isVoteInProgress } = {}
  ) {
    state.nomination = nomination || false;
    state.votes = votes || [];
    state.votingSpeed = votingSpeed || state.votingSpeed;
    state.lockedVote = lockedVote || 0;
    state.isVoteInProgress = isVoteInProgress || false;
  },
  /**
   * Create an entry in the vote history log. Requires current player array because it might change later in the game.
   * Only stores votes that were completed.
   * @param state
   * @param players
   */
  addHistory(state, players) {
    if (!canRecord(state)) return;
    if (!state.nomination || state.lockedVote <= players.length) return;
    const isExile = players[state.nomination[1]].role.team === "traveler";
    state.voteHistory.push({
      timestamp: new Date(),
      nominator: players[state.nomination[0]].name,
      nominee: players[state.nomination[1]].name,
      type: isExile ? "Exile" : "Execution",
      majority: Math.ceil(
        players.filter(player => !player.isDead || isExile).length / 2
      ),
      votes: players
        .filter((player, index) => state.votes[index])
        .map(({ name }) => name)
    });
  },
  /**
   * Record a Point Vote result in the vote history.
   * Only records when there is a single clear winner (no tie).
   * @param state
   * @param players
   */
  addPointVoteHistory(state, players) {
    if (!canRecord(state)) return;
    // players never saw the votes of an unrevealed Secret Point Vote
    if (isPointVoteHidden(state)) return;
    const tally = {};
    for (const t of Object.values(state.pointVotes)) {
      tally[t] = (tally[t] || 0) + 1;
    }
    const max = Math.max(...Object.values(tally), 0);
    if (max === 0) return;
    const leaders = Object.keys(tally)
      .filter(k => tally[k] === max)
      .map(Number);
    if (leaders.length !== 1) return;
    const nominee = players[leaders[0]] ? players[leaders[0]].name : "Unknown";
    const votes = Object.entries(state.pointVotes)
      .filter(([, t]) => t === leaders[0])
      .map(([voterIdx]) => (players[voterIdx] ? players[voterIdx].name : null))
      .filter(Boolean);
    state.voteHistory.push({
      timestamp: new Date(),
      nominator: "N/A",
      nominee,
      type: pointVoteName(state),
      majority: "N/A",
      votes
    });
  },
  addNightSeparator(state) {
    if (!canRecord(state)) return;
    const last = state.voteHistory[state.voteHistory.length - 1];
    if (last && last.type === "night") return;
    state.voteHistory.push({ type: "night" });
  },
  clearVoteHistory(state) {
    state.voteHistory = [];
  },
  /**
   * Store a vote with and without syncing it to the live session.
   * This is necessary in order to prevent infinite voting loops.
   * @param state
   * @param vote
   */
  vote: handleVote,
  voteSync: handleVote,
  lockVote(state, lock) {
    state.lockedVote = lock !== undefined ? lock : state.lockedVote + 1;
  },
  toggleNight: toggleFlag("isNight"),
  toggleHiddenVoting: toggleFlag("isHiddenVoting"),
  toggleReturnToTown: toggleFlag("isReturnToTown"),
  toggleOneNight(state, val) {
    toggleFlag("isOneNight")(state, val);
    state.oneNightVotes = null;
  },
  /**
   * Re-index pointVotes after a player is removed.
   * Drops votes cast by or for the removed player; decrements all higher indices.
   */
  removePlayerFromPointVotes(state, removedIndex) {
    const reindex = votes => {
      const updated = {};
      for (const [voterIdxStr, targetIdxStr] of Object.entries(votes)) {
        const voter = Number(voterIdxStr);
        const target = Number(targetIdxStr);
        if (voter === removedIndex || target === removedIndex) continue;
        const newVoter = voter > removedIndex ? voter - 1 : voter;
        const newTarget = target > removedIndex ? target - 1 : target;
        updated[newVoter] = newTarget;
      }
      return updated;
    };
    if (state.oneNightVotes) state.oneNightVotes = reindex(state.oneNightVotes);
    if (!state.pointVoteActive && !state.pointVoteEnded) return;
    state.pointVotes = reindex(state.pointVotes);
  },
  declareVictory(state, team) {
    state.winningTeam = team;
    state.gameEnded = true;
    state.victoryCount++;
  },
  setVictoryCount: set("victoryCount"),
  clearVictory(state) {
    state.gameEnded = false;
    state.winningTeam = null;
  },
  setVictoryModalTeam: set("victoryModalTeam"),
  setVictoryReveal(state, snapshot) {
    state.victoryRevealSnapshot = snapshot;
    state.victoryRevealActive = true;
    state.revealCount++;
  },
  clearVictoryReveal(state) {
    state.victoryRevealActive = false;
    state.victoryRevealSnapshot = null;
  },
  setPointVoteActive(state, val) {
    state.pointVoteActive = val;
    if (val) {
      state.pointVotes = {};
      state.pointVoteCountdown = false;
      state.pointVoteEnded = false;
      state.pointVoteRevealed = false;
      state.pointVoteVoters = [];
      state.pointVoteRevealOrder = [];
      state.pointVoteRevealStep = 0;
      if (state.isOneNight) state.oneNightVotes = null;
    }
  },
  setPointVoteCountdown: set("pointVoteCountdown"),
  setPointVoteEnded: set("pointVoteEnded"),
  castPointVote(state, { voterIndex, targetIndex }) {
    if (targetIndex === null) {
      Vue.delete(state.pointVotes, voterIndex);
    } else {
      Vue.set(state.pointVotes, voterIndex, targetIndex);
    }
  },
  castPointVoteSync(state, { voterIndex, targetIndex }) {
    if (targetIndex === null) {
      Vue.delete(state.pointVotes, voterIndex);
    } else {
      Vue.set(state.pointVotes, voterIndex, targetIndex);
    }
  },
  setPointVotes(state, votes) {
    state.pointVotes = votes || {};
  },
  setPointVoteRevealed: set("pointVoteRevealed"),
  /** Start revealing the votes in the given voter order (synced). */
  startPointVoteReveal(state, order) {
    state.pointVoteRevealOrder = [...(order || [])];
    state.pointVoteRevealStep = 0;
    state.pointVoteRevealed = true;
    state.pointVoteRevealCount++;
  },
  setPointVoteRevealStep: set("pointVoteRevealStep"),
  /** Jump straight to the result (synced, ST only). */
  skipPointVoteReveal(state) {
    state.pointVoteRevealStep = state.pointVoteRevealOrder.length + 1;
  },
  /** Late joiners land on the finished reveal, without replaying it. */
  restorePointVoteReveal(state, order) {
    state.pointVoteRevealOrder = [...(order || [])];
    state.pointVoteRevealStep = state.pointVoteRevealOrder.length + 1;
  },
  setPointVoteVoters(state, voters) {
    state.pointVoteVoters = voters || [];
  },
  /**
   * Votes kept for One Night scoring after the vote panel closes.
   * null means no vote has happened this game.
   */
  setOneNightVotes(state, votes) {
    state.oneNightVotes = votes ? { ...votes } : null;
  },
  /** Keep saved votes with the same people when two seats are swapped. */
  swapOneNightVotes(state, [from, to]) {
    if (!state.oneNightVotes) return;
    state.oneNightVotes = remapVotes(state.oneNightVotes, seat =>
      seat === from ? to : seat === to ? from : seat
    );
  },
  /** Keep saved votes with the same people when a player is moved. */
  moveOneNightVotes(state, [from, to]) {
    if (!state.oneNightVotes) return;
    state.oneNightVotes = remapVotes(state.oneNightVotes, seat => {
      if (seat === from) return to;
      if (from < to && seat > from && seat <= to) return seat - 1;
      if (from > to && seat >= to && seat < from) return seat + 1;
      return seat;
    });
  }
};

export default {
  namespaced: true,
  state,
  getters,
  mutations
};
