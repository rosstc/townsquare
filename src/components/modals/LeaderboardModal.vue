<template>
  <Modal
    class="leaderboard-modal"
    v-if="modals.leaderboard && session.isOneNight"
    @close="close"
  >
    <h3>Leaderboard</h3>

    <p class="empty" v-if="!standings.length">No games recorded yet.</p>
    <table class="standings" v-else>
      <thead>
        <tr>
          <td>#</td>
          <td>Player</td>
          <td>Points</td>
          <td>Games</td>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in standings" :key="row.id">
          <td>{{ row.rank }}</td>
          <td class="name">{{ row.name }}</td>
          <td class="points">{{ row.total }}</td>
          <td>{{ row.games }}</td>
        </tr>
      </tbody>
    </table>

    <!-- ST controls -->
    <template v-if="!session.isSpectator">
      <template v-if="games.length">
        <h4>Games</h4>
        <table class="games">
          <tbody>
            <tr v-for="game in games" :key="game.id">
              <td>Game {{ game.id }}</td>
              <td class="time">{{ formatTime(game.time) }}</td>
              <td :class="game.winningTeam">
                {{ game.winningTeam === "good" ? "Good" : "Evil" }} wins
              </td>
              <td class="remove" @click="removeGame(game)">
                <font-awesome-icon icon="trash-alt" /> Remove
              </td>
            </tr>
          </tbody>
        </table>
      </template>

      <div class="options">
        <div class="option" @click="recoverScores">
          <font-awesome-icon icon="undo" /> Recover scores
        </div>
        <div class="option" @click="reset" v-if="games.length">
          <font-awesome-icon icon="trash-alt" /> Reset
        </div>
      </div>

      <div class="recovery" v-if="leaderboard.isRecovering">
        <p v-if="!leaderboard.recovered.length">
          Asking players for their copies…
        </p>
        <template v-else>
          <p>Copies found — choose one to restore:</p>
          <ul>
            <li v-for="(copy, i) in leaderboard.recovered" :key="i">
              <span>
                {{ copy.board.games.length }}
                game{{ copy.board.games.length !== 1 ? "s" : "" }}, last
                {{ formatTime(lastGameTime(copy.board)) }}, from
                {{ copy.from.join(", ") }}
              </span>
              <span class="restore" @click="restore(copy)">Restore</span>
            </li>
          </ul>
        </template>
      </div>
    </template>
  </Modal>
</template>

<script>
import Modal from "./Modal";
import { mapGetters, mapMutations, mapState } from "vuex";

export default {
  components: {
    Modal
  },
  computed: {
    ...mapState(["session", "modals", "leaderboard"]),
    ...mapGetters({ standings: "leaderboard/standings" }),
    // newest first
    games() {
      return [...this.leaderboard.games].sort((a, b) => b.id - a.id);
    }
  },
  methods: {
    formatTime(time) {
      if (!time) return "";
      const date = new Date(time);
      const pad = n => n.toString().padStart(2, "0");
      return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
    },
    lastGameTime(board) {
      return Math.max(...board.games.map(game => game.time || 0));
    },
    removeGame(game) {
      if (
        confirm(
          `Remove game ${game.id}? Its points come off every player's total.`
        )
      ) {
        this.$store.commit("leaderboard/removeGame", game.id);
      }
    },
    reset() {
      if (
        confirm(
          "Reset the leaderboard? Every game and score will be cleared for everyone."
        )
      ) {
        this.$store.commit("leaderboard/reset");
      }
    },
    recoverScores() {
      this.$store.commit("leaderboard/requestCopies");
    },
    restore(copy) {
      const games = copy.board.games.length;
      if (
        confirm(
          `Restore this leaderboard (${games} game${
            games !== 1 ? "s" : ""
          })? It replaces the current one for everyone.`
        )
      ) {
        this.$store.commit("leaderboard/set", copy.board);
        this.$store.commit("leaderboard/stopRecovering");
      }
    },
    close() {
      if (this.leaderboard.isRecovering) {
        this.$store.commit("leaderboard/stopRecovering");
      }
      this.toggleModal("leaderboard");
    },
    ...mapMutations(["toggleModal"])
  }
};
</script>

<style lang="scss" scoped>
@import "../../vars.scss";

h3 {
  margin: 0 40px 10px;
}

h4 {
  margin: 15px 0 5px;
  text-align: center;
}

.empty {
  text-align: center;
  opacity: 0.8;
}

table {
  border-spacing: 12px 2px;
  margin: 0 auto;
}

thead td {
  font-weight: bold;
  border-bottom: 1px solid white;
  text-align: center;
}

tbody td {
  text-align: center;
  &.name {
    text-align: left;
  }
  &.points {
    color: gold;
    font-weight: bold;
  }
}

.games td {
  text-align: left;
}

// the shared Modal styles lay lists out in a row; stack them instead
.recovery ul {
  flex-direction: column;
  li {
    display: flex;
    gap: 12px;
    align-items: center;
    margin-bottom: 4px;
  }
}

.time {
  opacity: 0.7;
}

.good {
  color: #7ec8ff;
}

.evil {
  color: #ff6060;
}

.remove,
.restore,
.option {
  cursor: pointer;
  &:hover {
    color: red;
  }
}

.restore {
  text-decoration: underline;
}

.options {
  display: flex;
  justify-content: center;
  gap: 30px;
  margin-top: 15px;
}

.recovery {
  margin-top: 10px;
  text-align: center;
  p {
    margin: 5px 0;
  }
}
</style>

<style lang="scss">
// sized from outside the shared Modal, so it never shrinks to fit when empty
.leaderboard-modal .modal {
  min-width: min(480px, 80%);
  min-height: 260px;
}
</style>
