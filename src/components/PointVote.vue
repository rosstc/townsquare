<template>
  <div id="point-vote">
    <template v-if="session.pointVoteEnded">
      <!-- One Night: votes are revealed one voter at a time -->
      <div class="overlay results" v-if="revealing">
        <em class="title">Revealing the votes…</em>
        <br />
        <span
          class="summary reveal-caption"
          :key="session.pointVoteRevealStep"
          >{{ revealCaption }}</span
        >
        <span class="reveal-progress">{{ revealProgress }}</span>
        <div class="button-group" v-if="!session.isSpectator">
          <div class="button" @click="skipReveal">Skip</div>
        </div>
      </div>
      <div class="overlay results" v-else>
        <em class="title">{{ voteName }} Result</em>
        <br />
        <template v-if="votesHidden">
          <span class="summary"
            >Votes are in — waiting for the Storyteller</span
          >
        </template>
        <template v-else-if="leaders.length === 0">
          <span class="summary">No votes were cast.</span>
        </template>
        <template v-else>
          <div
            class="result-entry"
            v-for="leaderIdx in leaders"
            :key="leaderIdx"
          >
            <span class="result-name">{{ players[leaderIdx].name }}</span>
            <span class="result-tally"
              >{{ leaderVoteCount }} vote{{
                leaderVoteCount !== 1 ? "s" : ""
              }}</span
            >
            <span class="result-voters"
              >Voters: {{ votersForPlayer(leaderIdx).join(", ") }}</span
            >
          </div>
        </template>
        <template v-if="!session.isSpectator && session.isOneNight">
          <span class="suggestion" :class="suggestedTeam">
            {{ suggestionText }}
          </span>
          <div class="button-group" v-if="!session.pointVoteRevealed">
            <div class="button townsfolk" @click="revealVotes">Show Votes</div>
            <div class="button demon" @click="closeResults">Close</div>
          </div>
          <template v-else>
            <div class="button-group">
              <div
                class="button"
                :class="{ disabled: leadersExecuted }"
                v-if="leaders.length"
                @click="executeLeaders"
              >
                Execute
              </div>
              <div class="button demon" @click="closeResults">Close</div>
            </div>
            <div class="button-group">
              <div class="button townsfolk" @click="openVictory('good')">
                Good Wins
              </div>
              <div class="button demon" @click="openVictory('evil')">
                Evil Wins
              </div>
            </div>
          </template>
        </template>
        <template v-else-if="!session.isSpectator">
          <div class="button-group">
            <div
              class="button"
              :class="{ disabled: session.markedPlayer === leaders[0] }"
              v-if="leaders.length === 1"
              @click="markTarget"
            >
              Mark Target
            </div>
            <div class="button" @click="clearMark">Clear Mark</div>
            <div class="button demon" @click="closeResults">Close</div>
          </div>
        </template>
      </div>
    </template>
    <template v-else>
      <div class="overlay">
        <em class="title">{{ voteName }}</em>
        <br />
        <span class="summary">{{ centerText }}</span>
        <template v-if="!session.isSpectator">
          <div class="button-group">
            <div
              class="button townsfolk"
              v-if="!session.pointVoteCountdown"
              @click="startCountdown"
            >
              End Vote (3s)
            </div>
            <div class="button demon" @click="close">Close</div>
          </div>
        </template>
      </div>
      <transition name="blur">
        <div class="countdown" v-if="session.pointVoteCountdown">
          <span>3</span>
          <span>2</span>
          <span>1</span>
          <audio
            :autoplay="!grimoire.isMuted"
            src="../assets/sounds/countdown.mp3"
            :muted="grimoire.isMuted"
          ></audio>
        </div>
      </transition>
    </template>
  </div>
</template>

<script>
import { mapGetters, mapState } from "vuex";
import { suggestedWinner, clockwiseVoteRevealOrder } from "@/utils/oneNight";

// One Night vote reveal pacing
const REVEAL_INTRO_MS = 1650;
const REVEAL_STEP_MS = 1320;
const REVEAL_RESULT_PAUSE_MS = 1980;

export default {
  computed: {
    ...mapState("players", ["players"]),
    ...mapState(["session", "grimoire"]),
    ...mapGetters({
      leaders: "session/pointVoteLeaders",
      votesHidden: "session/pointVotesHidden",
      voterIndices: "session/pointVoteVoterIndices",
      revealing: "session/pointVoteRevealing",
      voteName: "session/pointVoteName"
    }),
    revealCaption() {
      const {
        pointVoteRevealOrder,
        pointVoteRevealStep,
        pointVotes
      } = this.session;
      if (pointVoteRevealStep < 1) return "…";
      const voter = pointVoteRevealOrder[pointVoteRevealStep - 1];
      const name = this.players[voter] ? this.players[voter].name : "?";
      const target = pointVotes[voter];
      if (target === undefined || target === null) return `${name} didn't vote`;
      if (target === voter) return `${name} voted for themselves`;
      const targetName = this.players[target] ? this.players[target].name : "?";
      return `${name} → ${targetName}`;
    },
    revealProgress() {
      const total = this.session.pointVoteRevealOrder.length;
      return `${Math.min(this.session.pointVoteRevealStep, total)} / ${total}`;
    },
    centerText() {
      if (this.votesHidden) {
        const voted = this.voterIndices.length;
        // only seated players can vote
        const seated = this.players.filter(p => p.id).length;
        return `Secret Vote — ${voted} of ${seated} voted`;
      }
      if (this.leaders.length === 0) return "No votes yet";
      const names = this.leaders.map(i => this.players[i].name).join(", ");
      const count = this.leaderVoteCount;
      return `Highest Vote is for player ${names}. Vote Tally ${count}`;
    },
    suggestedTeam() {
      return suggestedWinner(this.players, this.leaders);
    },
    suggestionText() {
      return this.suggestedTeam === "good"
        ? "Suggested: Good wins — a Minion or Demon was executed"
        : "Suggested: Evil wins — no Minion or Demon executed";
    },
    leadersExecuted() {
      return this.leaders.every(i => this.players[i] && this.players[i].isDead);
    },
    leaderVoteCount() {
      if (this.leaders.length === 0) return 0;
      return Object.values(this.session.pointVotes).filter(
        t => t === this.leaders[0]
      ).length;
    }
  },
  created() {
    this.revealTimer = null;
    this.countdownTimer = null;
  },
  beforeDestroy() {
    clearTimeout(this.revealTimer);
    // a vote closed during the 3-2-1 must not come back when it finishes
    clearTimeout(this.countdownTimer);
  },
  watch: {
    // One Night: every client plays the reveal on its own timer
    "session.pointVoteRevealCount"() {
      this.playReveal();
    },
    "session.pointVoteCountdown"(val) {
      if (val && !this.session.isSpectator) {
        clearTimeout(this.countdownTimer);
        this.countdownTimer = setTimeout(() => {
          // One Night: keep the locked votes for scoring on the victory screen
          if (this.session.isOneNight) {
            this.$store.commit(
              "session/setOneNightVotes",
              this.session.pointVotes
            );
          }
          this.$store.commit("session/setPointVoteActive", false);
          this.$store.commit("session/setPointVoteEnded", true);
          // One Night: skull every player about to be executed, ties included.
          // Players only see these once the ST shows the votes.
          if (this.session.isOneNight && this.leaders.length) {
            this.$store.commit("session/setMarkedPlayer", [...this.leaders]);
          }
        }, 4000);
      }
    }
  },
  methods: {
    startCountdown() {
      this.$store.commit("session/setPointVoteCountdown", true);
    },
    close() {
      this.$store.commit("session/setPointVoteActive", false);
    },
    votersForPlayer(targetIdx) {
      return Object.entries(this.session.pointVotes)
        .filter(([, t]) => t === targetIdx)
        .map(([voterIdx]) =>
          this.players[voterIdx] ? this.players[voterIdx].name : null
        )
        .filter(Boolean);
    },
    markTarget() {
      if (this.leaders.length === 0) return;
      this.$store.commit("session/setMarkedPlayer", this.leaders[0]);
    },
    clearMark() {
      this.$store.commit("session/setMarkedPlayer", -1);
    },
    revealVotes() {
      const order = clockwiseVoteRevealOrder(
        this.players,
        this.session.pointVotes
      );
      this.$store.commit("session/startPointVoteReveal", order);
    },
    skipReveal() {
      this.$store.commit("session/skipPointVoteReveal");
    },
    playReveal() {
      clearTimeout(this.revealTimer);
      const advance = () => {
        const total = this.session.pointVoteRevealOrder.length;
        const step = this.session.pointVoteRevealStep;
        // already at the result (finished, or skipped by the ST)
        if (step > total) return;
        this.$store.commit("session/setPointVoteRevealStep", step + 1);
        if (step + 1 <= total) {
          const delay =
            step + 1 === total ? REVEAL_RESULT_PAUSE_MS : REVEAL_STEP_MS;
          this.revealTimer = setTimeout(advance, delay);
        }
      };
      this.revealTimer = setTimeout(advance, REVEAL_INTRO_MS);
    },
    /**
     * One Night: every top-voted player is executed, ties included.
     */
    executeLeaders() {
      this.leaders.forEach(i => {
        const player = this.players[i];
        if (!player || player.isDead) return;
        this.$store.commit("players/update", {
          player,
          property: "isDead",
          value: true
        });
      });
    },
    openVictory(team) {
      this.$store.commit("session/setVictoryModalTeam", team);
    },
    closeResults() {
      this.$store.commit("session/addPointVoteHistory", this.players);
      this.$store.commit("session/setPointVoteEnded", false);
    }
  }
};
</script>

<style lang="scss" scoped>
@import "../vars.scss";

#point-vote {
  position: absolute;
  width: 20%;
  z-index: 20;
  display: flex;
  align-items: center;
  align-content: center;
  justify-content: center;
  text-align: center;
  text-shadow: 0 1px 2px #000000, 0 -1px 2px #000000, 1px 0 2px #000000,
    -1px 0 2px #000000;

  &:after {
    content: " ";
    padding-bottom: 100%;
    display: block;
  }

  .title {
    color: $demon;
    font-style: normal;
    font-weight: bold;
    font-size: 120%;
  }

  .summary {
    font-size: 85%;
    line-height: 1.4;
  }

  .reveal-caption {
    font-size: 120%;
    font-weight: bold;
    animation: reveal-caption-in 400ms ease-out;
  }

  .reveal-progress {
    font-size: 75%;
    opacity: 0.7;
  }

  .suggestion {
    font-size: 75%;
    line-height: 1.3;
    &.good {
      color: #7ec8ff;
    }
    &.evil {
      color: #ff6060;
    }
  }
}

.overlay {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.results {
  .result-entry {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 4px;
  }

  .result-name {
    font-weight: bold;
    font-size: 130%;
    color: $townsfolk;
  }

  .result-tally {
    font-size: 90%;
  }

  .result-voters {
    font-size: 78%;
    opacity: 0.85;
    line-height: 1.3;
  }
}

@keyframes reveal-caption-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes countdown {
  0% {
    transform: scale(1.5);
    opacity: 0;
    filter: blur(20px);
  }
  10% {
    opacity: 1;
  }
  50% {
    transform: scale(1);
    filter: blur(0);
  }
  90% {
    color: $townsfolk;
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}

.countdown {
  display: flex;
  position: absolute;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  audio {
    height: 0;
    width: 0;
    visibility: hidden;
  }
  span {
    position: absolute;
    font-size: 8em;
    font-weight: bold;
    opacity: 0;
  }
  span:nth-child(1) {
    animation: countdown 1100ms normal forwards;
  }
  span:nth-child(2) {
    animation: countdown 1100ms normal forwards 1000ms;
  }
  span:nth-child(3) {
    animation: countdown 1100ms normal forwards 2000ms;
  }
}
</style>
