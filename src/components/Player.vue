<template>
  <li :style="zoom" :class="{ 'menu-open': isMenuOpen }">
    <div
      ref="player"
      class="player"
      :class="[
        {
          dead: player.isDead,
          marked: isMarked,
          'no-vote': player.isVoteless,
          you: session.sessionId && player.id && player.id === session.playerId,
          'vote-yes': session.votes[index],
          'vote-lock': voteLocked,
          'hidden-voting': session.isHiddenVoting,
          'hand-raised': player.handRaised,
          'point-vote-leader': isPointVoteLeader,
          'my-vote-leader': isMyVoteTarget,
          'my-secret-vote': pointVotesHidden && isMyVoteTarget,
          'vote-reveal-current': pointVoteRevealCurrent === index,
          'glow-good':
            session.isSpectator &&
            player.id === session.playerId &&
            selfAlignment === 'good',
          'glow-evil':
            session.isSpectator &&
            player.id === session.playerId &&
            selfAlignment === 'evil'
        },
        player.role.team
      ]"
    >
      <div class="shroud" @click="toggleStatus()"></div>
      <div
        class="life"
        @click="session.pointVoteActive ? onTokenClick() : toggleStatus()"
      ></div>
      <div class="handUp"></div>
      <div
        class="night-order first"
        v-if="nightOrder.get(player).first && grimoire.isNightOrder"
      >
        <em>{{ nightOrder.get(player).first }}.</em>
        <span v-if="player.role.firstNightReminder">{{
          player.role.firstNightReminder
        }}</span>
      </div>
      <div
        class="night-order other"
        v-if="nightOrder.get(player).other && grimoire.isNightOrder"
      >
        <em>{{ nightOrder.get(player).other }}.</em>
        <span v-if="player.role.otherNightReminder">{{
          player.role.otherNightReminder
        }}</span>
      </div>

      <div
        class="emote"
        v-if="!session.isSpectator || player.id === session.playerId"
        @click="toggleHandRaised()"
      >
        <em>
          <font-awesome-icon icon="hand-paper" size="xs" />
        </em>
      </div>

      <Token :role="player.role" @set-role="onTokenClick" />

      <!-- Alignment overlay (ST view: ST-set alignment; player view: self-set alignment) -->
      <div
        v-if="displayedAlignment"
        class="alignment-overlay"
        :class="displayedAlignment"
      ></div>

      <!-- Alignment toggle button -->
      <div
        class="alignment-btn"
        :class="displayedAlignment || 'unset'"
        @click.stop="cycleCurrentAlignment"
      ></div>

      <!-- Overlay icons -->
      <div class="overlay">
        <font-awesome-icon
          icon="hand-paper"
          class="vote"
          title="Hand UP"
          @click="vote()"
        />
        <font-awesome-icon
          icon="times"
          class="vote"
          title="Hand DOWN"
          @click="vote()"
        />
        <font-awesome-icon
          icon="eye-slash"
          class="vote"
          title="Hand DOWN"
          @click="vote()"
        />
        <font-awesome-icon
          icon="times-circle"
          class="cancel"
          title="Cancel"
          @click="cancel()"
        />
        <font-awesome-icon
          icon="exchange-alt"
          class="swap"
          @click="swapPlayer(player)"
          title="Swap seats with this player"
        />
        <font-awesome-icon
          icon="redo-alt"
          class="move"
          @click="movePlayer(player)"
          title="Move player to this seat"
        />
        <font-awesome-icon
          icon="hand-point-right"
          class="nominate"
          @click="nominatePlayer(player)"
          title="Nominate this player"
        />
      </div>

      <!-- Claimed seat icon -->
      <font-awesome-icon
        icon="chair"
        v-if="player.id && session.sessionId"
        class="seat"
        :class="{ highlight: session.isRolesDistributed }"
      />

      <!-- Ghost vote icon -->
      <font-awesome-icon
        icon="vote-yea"
        class="has-vote"
        v-if="player.isDead && !player.isVoteless"
        @click="updatePlayer('isVoteless', true)"
        title="Ghost vote"
      />

      <!-- On block icon -->
      <div class="marked">
        <font-awesome-icon icon="skull" />
      </div>

      <!-- Point Vote direction arrow -->
      <div
        class="point-vote-arrow"
        v-if="displayedBearing !== null"
        :class="{
          dimmed:
            session.pointVoteActive &&
            session.isSpectator &&
            !isOwnPointVoteHand,
          own:
            session.pointVoteActive &&
            session.isSpectator &&
            isOwnPointVoteHand,
          revealing: pointVoteRevealing
        }"
        :style="{ transform: `rotate(${displayedBearing - 90}deg)` }"
      >
        <font-awesome-icon icon="hand-point-right" />
      </div>

      <!-- Point Vote tally overlay -->
      <div
        class="point-vote-tally"
        v-if="showPointVoteTally"
        :key="pointVoteRevealing ? 'tally-' + pointVoteTally.length : 'tally'"
        :class="{ pop: pointVoteRevealing }"
      >
        <span class="count">Votes: {{ pointVoteTally.length }}</span>
        <span class="voters">{{ pointVoteTally.join(", ") }}</span>
      </div>

      <!-- Secret Point Vote: shows that this player has voted, not for whom -->
      <div class="point-vote-voted" v-if="hasPointVoted" title="Has voted">
        <font-awesome-icon icon="vote-yea" />
      </div>

      <div
        class="name"
        @click="
          (!session.pointVoteActive ||
            !players.some(p => p.id === session.playerId)) &&
            (isMenuOpen = !isMenuOpen)
        "
        :class="{ active: isMenuOpen }"
      >
        <span>{{ player.name }}</span>
        <font-awesome-icon icon="venus-mars" v-if="player.pronouns" />
        <div class="pronouns" v-if="player.pronouns">
          <span>{{ player.pronouns }}</span>
        </div>
      </div>

      <transition name="fold">
        <ul class="menu" v-if="isMenuOpen">
          <li
            @click="changePronouns"
            v-if="
              !session.isSpectator ||
                (session.isSpectator && player.id === session.playerId)
            "
          >
            <font-awesome-icon icon="venus-mars" />Change Pronouns
          </li>
          <template v-if="!session.isSpectator">
            <li @click="changeName">
              <font-awesome-icon icon="user-edit" />Rename
            </li>
            <li @click="movePlayer()" :class="{ disabled: session.lockedVote }">
              <font-awesome-icon icon="redo-alt" />
              Move player
            </li>
            <li @click="swapPlayer()" :class="{ disabled: session.lockedVote }">
              <font-awesome-icon icon="exchange-alt" />
              Swap seats
            </li>
            <li @click="removePlayer" :class="{ disabled: session.lockedVote }">
              <font-awesome-icon icon="times-circle" />
              Remove
            </li>
            <li
              @click="updatePlayer('id', '', true)"
              v-if="player.id && session.sessionId"
            >
              <font-awesome-icon icon="chair" />
              Empty seat
            </li>
            <template v-if="!session.nomination && !session.isOneNight">
              <li @click="nominatePlayer()">
                <font-awesome-icon icon="hand-point-right" />
                Nomination
              </li>
            </template>
          </template>
          <li
            @click="claimSeat"
            v-if="session.isSpectator"
            :class="{ disabled: player.id && player.id !== session.playerId }"
          >
            <font-awesome-icon icon="chair" />
            <template v-if="!player.id">
              Claim seat
            </template>
            <template v-else-if="player.id === session.playerId">
              Vacate seat
            </template>
            <template v-else> Seat occupied</template>
          </li>
        </ul>
      </transition>
    </div>

    <template v-if="player.reminders">
      <div
        class="reminder"
        :key="reminder.role + ' ' + reminder.name"
        v-for="reminder in player.reminders"
        :class="[reminder.role]"
        @click="removeReminder(reminder)"
      >
        <span
          class="icon"
          :style="{
            backgroundImage: `url(${
              reminder.image && grimoire.isImageOptIn
                ? reminder.image
                : require('../assets/icons/' +
                    (reminder.imageAlt || reminder.role) +
                    '.png')
            })`
          }"
        ></span>
        <span class="text">{{ reminder.name }}</span>
        <div
          v-if="reminder.name === 'GOOD Hannibal'"
          class="reminder-alignment-overlay good"
        ></div>
      </div>
    </template>
    <div class="reminder add" @click="$emit('trigger', ['openReminderModal'])">
      <span class="icon"></span>
    </div>
    <div class="reminderHoverTarget"></div>
  </li>
</template>

<script>
import Token from "./Token";
import { mapGetters, mapState } from "vuex";

export default {
  components: {
    Token
  },
  props: {
    player: {
      type: Object,
      required: true
    }
  },
  computed: {
    ...mapState("players", ["players"]),
    ...mapState(["grimoire", "session"]),
    ...mapGetters({
      nightOrder: "players/nightOrder",
      pointVoteLeaders: "session/pointVoteLeaders",
      pointVotesHidden: "session/pointVotesHidden",
      pointVoteVoterIndices: "session/pointVoteVoterIndices",
      pointVoteRevealing: "session/pointVoteRevealing",
      pointVoteRevealCurrent: "session/pointVoteRevealCurrent",
      visiblePointVotes: "session/visiblePointVotes"
    }),
    isMarked() {
      const {
        isOneNight,
        isSpectator,
        markedPlayer,
        markedPlayers
      } = this.session;
      if (!isOneNight) return markedPlayer === this.index;
      // One Night: players see the skulls once the vote reveal has finished
      if (isSpectator && this.pointVoteRevealing) return false;
      return markedPlayers.includes(this.index);
    },
    index: function() {
      return this.players.indexOf(this.player);
    },
    voteLocked: function() {
      const session = this.session;
      const players = this.players.length;
      if (!session.nomination) return false;
      const indexAdjusted =
        (this.index - 1 + players - session.nomination[1]) % players;
      return indexAdjusted < session.lockedVote - 1;
    },
    pointVoteTally() {
      return Object.entries(this.visiblePointVotes)
        .filter(([, targetIdx]) => targetIdx === this.index)
        .map(([voterIdx]) =>
          this.players[voterIdx] ? this.players[voterIdx].name : null
        )
        .filter(Boolean);
    },
    showPointVoteTally() {
      if (!this.pointVoteTally.length || this.pointVotesHidden) return false;
      if (this.session.pointVoteActive) return true;
      // One Night: tallies stay up after the vote, for the ST and after the reveal
      return this.session.isOneNight && this.session.pointVoteEnded;
    },
    hasPointVoted() {
      const { isOneNight, pointVoteActive, pointVoteEnded } = this.session;
      if (!isOneNight) return false;
      if (!pointVoteActive && !(pointVoteEnded && this.pointVotesHidden)) {
        return false;
      }
      return this.pointVoteVoterIndices.includes(this.index);
    },
    displayedAlignment() {
      if (!this.session.isSpectator) return this.player.alignment || null;
      return this.selfAlignment;
    },
    isPointVoteLeader() {
      return (
        (this.session.pointVoteActive || this.session.pointVoteEnded) &&
        this.pointVoteLeaders.includes(this.index)
      );
    },
    myPlayerIndex() {
      if (!this.session.isSpectator) return -1;
      return this.players.findIndex(p => p.id === this.session.playerId);
    },
    isOwnPointVoteHand() {
      return this.myPlayerIndex === this.index;
    },
    isMyVoteTarget() {
      if (this.myPlayerIndex < 0) return false;
      return this.visiblePointVotes[this.myPlayerIndex] === this.index;
    },
    pointVoteBearing() {
      if (!this.session.pointVoteActive && !this.session.pointVoteEnded)
        return null;
      const targetIndex = this.visiblePointVotes[this.index];
      if (targetIndex === undefined || targetIndex === null) return null;
      if (targetIndex === this.index) {
        // One Night: the hand sits above the token, so point down at it
        return this.session.isOneNight ? 180 : null;
      }
      const n = this.players.length;
      const rotI = (this.index / n) * 2 * Math.PI;
      const rotJ = (targetIndex / n) * 2 * Math.PI;

      // Arrow CSS: top:-20%, left:25%, width:50%, height:50%
      // Arrow centre within .player: x=50%, y=5% → offset from token centre: dx=0, dy=-45%
      // Token width as fraction of circle radius (R ≈ 50vh, token ≈ 16vh for ≤10 players)
      const z = this.grimoire.zoom;
      let tokenVh;
      if (n < 7) tokenVh = 18 + z;
      else if (n <= 10) tokenVh = 16 + z;
      else if (n <= 15) tokenVh = 14 + z;
      else tokenVh = 12 + z;
      const arrowOffsetY = -0.45 * (tokenVh / 50); // upward offset in radius units

      // Screen-space positions on unit circle (y positive = down)
      const ix = Math.sin(rotI),
        iy = -Math.cos(rotI);
      const jx = Math.sin(rotJ),
        jy = -Math.cos(rotJ);

      // Shoot from arrow's actual position, not token centre
      const ax = ix;
      const ay = iy + arrowOffsetY;

      return (Math.atan2(jx - ax, -(jy - ay)) * 180) / Math.PI;
    },
    zoom: function() {
      const unit = window.innerWidth > window.innerHeight ? "vh" : "vw";
      if (this.players.length < 7) {
        return { width: 18 + this.grimoire.zoom + unit };
      } else if (this.players.length <= 10) {
        return { width: 16 + this.grimoire.zoom + unit };
      } else if (this.players.length <= 15) {
        return { width: 14 + this.grimoire.zoom + unit };
      } else {
        return { width: 12 + this.grimoire.zoom + unit };
      }
    }
  },
  data() {
    return {
      isMenuOpen: false,
      selfAlignment: null,
      displayedBearing: null
    };
  },
  mounted() {
    const key = `localAlignment_${this.session.playerId}_${this.player.id}`;
    this.selfAlignment = localStorage.getItem(key) || null;
  },
  watch: {
    pointVoteBearing(newVal) {
      if (newVal === null) {
        this.displayedBearing = null;
        return;
      }
      if (this.displayedBearing === null) {
        if (this.pointVoteRevealing) {
          // One Night reveal: the hand appears pointing up, then swings round
          this.displayedBearing = 0;
          setTimeout(() => {
            if (this.pointVoteBearing !== null) {
              this.turnHandTo(this.pointVoteBearing);
            }
          }, 50);
          return;
        }
        // First vote — snap to position with no animation
        this.displayedBearing = newVal;
        return;
      }
      this.turnHandTo(newVal);
    }
  },
  methods: {
    turnHandTo(bearing) {
      // Shortest-path delta so the hand always spins the right way
      let delta = bearing - this.displayedBearing;
      delta = ((((delta + 180) % 360) + 360) % 360) - 180;
      this.displayedBearing = this.displayedBearing + delta;
    },
    cycleCurrentAlignment() {
      if (!this.session.isSpectator) {
        this.cycleAlignment();
      } else {
        this.cycleSelfAlignment();
      }
    },
    alignmentCycleNext(current) {
      const team = this.player.role.team;
      if (team === "traveler") {
        // full cycle: null → good → evil → null
        if (current === null) return "good";
        if (current === "good") return "evil";
        return null;
      }
      const baseEvil = team === "minion" || team === "demon";
      const opposite = baseEvil ? "good" : "evil";
      // two-step cycle: null → opposite → null
      return current === null ? opposite : null;
    },
    cycleAlignment() {
      this.updatePlayer(
        "alignment",
        this.alignmentCycleNext(this.player.alignment)
      );
    },
    cycleSelfAlignment() {
      const next = this.alignmentCycleNext(this.selfAlignment);
      this.selfAlignment = next;
      const key = `localAlignment_${this.session.playerId}_${this.player.id}`;
      if (next) {
        localStorage.setItem(key, next);
      } else {
        localStorage.removeItem(key);
      }
    },
    changePronouns() {
      if (this.session.isSpectator && this.player.id !== this.session.playerId)
        return;
      const pronouns = prompt("Player pronouns", this.player.pronouns);
      //Only update pronouns if not null (prompt was not cancelled)
      if (pronouns !== null) {
        this.updatePlayer("pronouns", pronouns, true);
      }
    },
    toggleStatus() {
      if (this.grimoire.isPublic) {
        if (!this.player.isDead) {
          this.updatePlayer("isDead", true);
        } else if (this.player.isVoteless) {
          this.updatePlayer("isVoteless", false);
          this.updatePlayer("isDead", false);
        } else {
          this.updatePlayer("isVoteless", true);
        }
      } else {
        this.updatePlayer("isDead", !this.player.isDead);
        if (this.player.isMarked) {
          this.updatePlayer("isMarked", false);
        }
        if (this.player.isVoteless) {
          this.updatePlayer("isVoteless", false);
        }
      }
    },
    toggleHandRaised() {
      if (this.session.isSpectator && this.player.id !== this.session.playerId)
        return;
      this.updatePlayer("handRaised", !this.player.handRaised);
    },
    changeName() {
      if (this.session.isSpectator) return;
      const name = prompt("Player name", this.player.name) || this.player.name;
      this.updatePlayer("name", name, true);
    },
    removeReminder(reminder) {
      const reminders = [...this.player.reminders];
      reminders.splice(this.player.reminders.indexOf(reminder), 1);
      this.updatePlayer("reminders", reminders, true);
    },
    updatePlayer(property, value, closeMenu = false) {
      if (
        this.session.isSpectator &&
        property !== "reminders" &&
        property !== "pronouns" &&
        property !== "handRaised"
      )
        return;
      this.$store.commit("players/update", {
        player: this.player,
        property,
        value
      });
      if (closeMenu) {
        this.isMenuOpen = false;
      }
    },
    removePlayer() {
      this.isMenuOpen = false;
      this.$emit("trigger", ["removePlayer"]);
    },
    swapPlayer(player) {
      this.isMenuOpen = false;
      this.$emit("trigger", ["swapPlayer", player]);
    },
    movePlayer(player) {
      this.isMenuOpen = false;
      this.$emit("trigger", ["movePlayer", player]);
    },
    nominatePlayer(player) {
      this.isMenuOpen = false;
      this.$emit("trigger", ["nominatePlayer", player]);
    },
    cancel() {
      this.$emit("trigger", ["cancel"]);
    },
    claimSeat() {
      this.isMenuOpen = false;
      this.$emit("trigger", ["claimSeat"]);
    },
    /**
     * Allow the ST to override a locked vote.
     */
    vote() {
      if (this.session.isSpectator) return;
      if (!this.voteLocked) return;
      this.$store.commit("session/voteSync", [
        this.index,
        !this.session.votes[this.index]
      ]);
    },
    onTokenClick() {
      if (this.session.pointVoteActive) {
        this.castPointVote();
      } else {
        this.$emit("trigger", ["openRoleModal"]);
      }
    },
    castPointVote() {
      // ST cannot vote (isSpectator === false means ST)
      if (!this.session.isSpectator) return;
      if (this._pointVoteDebounce) return;
      this._pointVoteDebounce = true;
      setTimeout(() => {
        this._pointVoteDebounce = false;
      }, 250);
      const voterIndex = this.players.findIndex(
        p => p.id === this.session.playerId
      );
      if (voterIndex < 0) return;
      // clicking the same player again removes the vote
      const currentTarget = this.session.pointVotes[voterIndex];
      const targetIndex = currentTarget === this.index ? null : this.index;
      this.$store.commit("session/castPointVoteSync", {
        voterIndex,
        targetIndex
      });
    }
  }
};
</script>

<style lang="scss">
@import "../vars.scss";

.circle > li.menu-open {
  z-index: 50 !important;
}

.fold-enter-active,
.fold-leave-active {
  transition: transform 250ms ease-in-out;
  transform-origin: left center;
  transform: perspective(200px);
}
.fold-enter,
.fold-leave-to {
  transform: perspective(200px) rotateY(90deg);
}

/***** Player token *****/
.circle .player {
  margin-bottom: 10px;

  &:before {
    content: " ";
    display: block;
    padding-top: 100%;
  }

  .shroud {
    top: 0;
    left: 0;
    position: absolute;
    width: 100%;
    height: 45%;
    cursor: pointer;
    transform: rotateX(0deg);
    transform-origin: top center;
    transition: transform 200ms ease-in-out;
    z-index: 4;
    filter: drop-shadow(0 0 5px rgba(0, 0, 0, 0.8));

    &:before {
      content: " ";
      background: url("../assets/shroud.png") center -10px no-repeat;
      background-size: auto 110%;
      position: absolute;
      margin-left: -50%;
      width: 100%;
      height: 100%;
      left: 50%;
      top: -30%;
      opacity: 0;
      transform: perspective(400px) scale(1.5);
      transform-origin: top center;
      transition: all 200ms;
      pointer-events: none;
    }

    #townsquare.spectator & {
      pointer-events: none;
    }

    #townsquare:not(.spectator) &:hover:before {
      opacity: 0.5;
      top: -10px;
      transform: scale(1);
    }
  }

  &.dead .shroud:before {
    opacity: 1;
    top: 0;
    transform: perspective(400px) scale(1);
  }

  #townsquare:not(.spectator) &.dead .shroud:hover:before {
    opacity: 1;
  }

  .handUp {
    bottom: 0;
    left: 0;
    position: absolute;
    width: 60%;
    height: 45%;
    transform: rotateX(0deg);
    transform: rotate(-20deg);
    transform-origin: top left;
    cursor: pointer;
    transition: transform 200ms ease-in-out;
    z-index: 6;
    pointer-events: none;
    filter: drop-shadow(0 0 5px rgba(0, 0, 0, 0.8));

    &:before {
      content: " ";
      background: url("../assets/handUp.png") center -0px no-repeat;
      background-size: auto 70%;
      position: absolute;
      margin-left: -100%;
      margin-top: -24%;
      width: 100%;
      height: 100%;
      left: 45%;
      top: -30%;
      opacity: 0;
      transform: perspective(400px) scale(1.5);
      transform-origin: top left;
      transition: all 250ms;
      pointer-events: none;
    }

    #townsquare.spectator & {
      pointer-events: none;
    }
  }

  &.hand-raised .handUp:before {
    opacity: 1;
    top: 0;
    pointer-events: none;
    transform: perspective(400px) scale(1);
  }
}

/****** Life token *******/
.player {
  z-index: 2;
  .life {
    border-radius: 50%;
    width: 100%;
    background: url("../assets/life.png") center center;
    background-size: 100%;
    border: 3px solid black;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
    cursor: pointer;
    transition: transform 200ms ease-in-out;
    transform: perspective(400px) rotateY(180deg);
    backface-visibility: hidden;
    position: absolute;
    left: 0;
    top: 0;

    &:before {
      content: " ";
      display: block;
      padding-top: 100%;
    }
  }

  &.dead {
    &.no-vote .life:after {
      display: none;
    }

    .life {
      background-image: url("../assets/death.png");

      &:after {
        content: " ";
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
        background: url("../assets/vote.png") center center no-repeat;
        background-size: 50%;
        height: 100%;
        pointer-events: none;
      }
    }
  }

  &.traveler .life {
    filter: grayscale(100%);
  }
}

#townsquare.public .player {
  .shroud {
    transform: perspective(400px) rotateX(90deg);
    pointer-events: none;
  }

  .life {
    transform: perspective(400px) rotateY(0deg);
  }

  &.traveler:not(.dead) .token {
    transform: perspective(400px) scale(0.8);
    pointer-events: none;
    transition-delay: 0s;
  }

  &.traveler.dead .token {
    transition-delay: 0s;
  }
}

/***** Alignment button ******/
.player .alignment-btn {
  position: absolute;
  width: 31px;
  height: 31px;
  border-radius: 50%;
  right: -3%;
  bottom: -10%;
  top: 12.5%;
  border: 2.5px solid black;
  filter: drop-shadow(0 0 6px rgba(0, 0, 0, 0.5));
  cursor: pointer;
  z-index: 5;
  pointer-events: all;
  display: flex;
  justify-content: center;
  align-items: center;
  transition: background 300ms ease;

  &.unset {
    background: linear-gradient(180deg, #555 0%, #888 100%);
    opacity: 0.5;
  }

  &.good {
    background: linear-gradient(180deg, #1a5fd4 0%, #4da6ff 100%);
    opacity: 1;
  }

  &.evil {
    background: linear-gradient(180deg, #a00 0%, #e03030 100%);
    opacity: 1;
  }

  #townsquare.public & {
    opacity: 0;
    pointer-events: none;
  }
}

// Spectator view: own token button always visible; other tokens only on hover when unset
#townsquare.spectator .player:not(.you) .alignment-btn.unset {
  opacity: 0;
}
#townsquare.spectator li:hover .player:not(.you) .alignment-btn.unset {
  opacity: 0.4;
}

/***** Alignment overlay ******/
.player .alignment-overlay {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  aspect-ratio: 1 / 1;
  border-radius: 50%;
  pointer-events: none;
  mix-blend-mode: color;
  z-index: 3;
  transition: transform 200ms ease-in-out;
  transform: perspective(400px) rotateY(0deg);
  backface-visibility: hidden;

  &.good {
    background: rgba(40, 110, 255, 0.85);
  }

  &.evil {
    background: rgba(220, 40, 40, 0.85);
  }
}

#townsquare.public .circle .alignment-overlay {
  transform: perspective(400px) rotateY(-180deg);
}

/***** Role token ******/
.player .token {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  transition: transform 200ms ease-in-out;
  transform: perspective(400px) rotateY(0deg);
  backface-visibility: hidden;
}

#townsquare.public .circle .token {
  transform: perspective(400px) rotateY(-180deg);
}

/****** Player choice icons *******/
.player .overlay {
  width: 100%;
  position: absolute;
  pointer-events: none;
  top: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  &:after {
    content: " ";
    display: block;
    padding-top: 100%;
  }
}
.player .overlay svg {
  position: absolute;
  filter: drop-shadow(0 0 3px black);
  z-index: 5;
  cursor: pointer;
  &.swap,
  &.move,
  &.nominate,
  &.vote,
  &.cancel {
    width: 50%;
    height: 60%;
    opacity: 0;
    pointer-events: none;
    transition: all 250ms;
    transform: scale(0.2);
    * {
      stroke-width: 10px;
      stroke: white;
      fill: url(#default);
    }
    &:hover *,
    &.fa-hand-paper * {
      fill: url(#demon);
    }
    &.fa-times * {
      fill: url(#townsfolk);
    }
    &.fa-eye-slash * {
      fill: rgb(21, 39, 20);
    }
  }
}

// other player voted yes, but is not locked yet
#townsquare.vote .player.vote-yes .overlay svg.vote.fa-hand-paper {
  opacity: 0.5;
  transform: scale(1);
}

// you voted yes | a locked vote yes | a locked vote no (hidden & not hidden)
#townsquare.vote .player.you.vote-yes .overlay svg.vote.fa-hand-paper,
#townsquare.vote .player.vote-lock.vote-yes .overlay svg.vote.fa-hand-paper,
#townsquare.vote
  .player.vote-lock:not(.vote-yes):not(.hidden-voting)
  .overlay
  svg.vote.fa-times,
#townsquare.vote
  .player.vote-lock:not(.vote-yes).hidden-voting
  .overlay
  svg.vote.fa-eye-slash {
  opacity: 1;
  transform: scale(1);
}

// a locked vote can be clicked on by the ST
#townsquare.vote:not(.spectator) .player.vote-lock .overlay svg.vote {
  pointer-events: all;
}

li.from:not(.nominate) .player .overlay svg.cancel {
  opacity: 1;
  transform: scale(1);
  pointer-events: all;
}

li.swap:not(.from) .player .overlay svg.swap,
li.nominate .player .overlay svg.nominate,
li.move:not(.from) .player .overlay svg.move {
  opacity: 1;
  transform: scale(1);
  pointer-events: all;
}

/****** Vote icon ********/
.player .has-vote {
  color: #fff;
  filter: drop-shadow(0 0 3px black);
  transition: opacity 250ms;
  z-index: 2;

  #townsquare.public & {
    opacity: 0;
    pointer-events: none;
  }
}

.has-vote {
  position: absolute;
  margin-top: -15%;
  right: 2px;
}

/****** Session seat glow *****/
@mixin glow($name, $color) {
  @keyframes #{$name}-glow {
    0% {
      box-shadow: 0 0 rgba($color, 1);
      border-color: $color;
    }
    50% {
      border-color: black;
    }
    100% {
      box-shadow: 0 0 20px 16px transparent;
      border-color: $color;
    }
  }

  .player.you.#{$name} .token {
    animation: #{$name}-glow 5s ease-in-out infinite;
  }
}

@include glow("townsfolk", $townsfolk);
@include glow("outsider", $outsider);
@include glow("demon", $demon);
@include glow("minion", $minion);
@include glow("traveler", $traveler);

.player.you .token {
  animation: townsfolk-glow 5s ease-in-out infinite;
}

// Alignment override: seated player's self-alignment overrides team glow
.player.you.glow-good .token {
  animation: townsfolk-glow 5s ease-in-out infinite !important;
}
.player.you.glow-evil .token {
  animation: demon-glow 5s ease-in-out infinite !important;
}

/****** Marked icon ******/
.player .marked {
  position: absolute;
  width: 100%;
  top: 0;
  filter: drop-shadow(0px 0px 6px black);
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 250ms;
  opacity: 0;
  &:before {
    content: " ";
    padding-top: 100%;
    display: block;
  }
  svg {
    height: 60%;
    width: 60%;
    position: absolute;
    stroke: white;
    stroke-width: 15px;
    path {
      fill: white;
    }
  }
}
.player.marked .marked {
  opacity: 0.5;
}

/****** Seat icon ********/
.player .seat {
  position: absolute;
  left: 2px;
  margin-top: -15%;
  color: #fff;
  filter: drop-shadow(0 0 3px black);
  cursor: default;
  z-index: 2;
  &.highlight {
    animation-iteration-count: 1;
    animation: redToWhite 1s normal forwards;
  }
}

// highlight animation
@keyframes redToWhite {
  from {
    color: $demon;
  }
  to {
    color: white;
  }
}

.player.you .seat {
  color: $townsfolk;
}

/***** Player name *****/
.player > .name {
  right: 10%;
  display: flex;
  justify-content: center;
  font-size: 110%;
  line-height: 120%;
  cursor: pointer;
  white-space: nowrap;
  width: 113%;
  background: rgba(0, 0, 0, 0.5);
  border: 2px solid black;
  border-radius: 10px;
  top: 5px;
  box-shadow: 0 0 5px black;
  padding: 0 4px;

  svg {
    top: 3px;
    margin-right: 2px;
  }

  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: center;
    flex-grow: 1;
  }

  #townsquare:not(.spectator) &:hover,
  &.active {
    color: red;
  }

  &:hover .pronouns {
    opacity: 1;
    color: white;
  }

  .pronouns {
    display: flex;
    position: absolute;
    right: 110%;
    max-width: 250px;
    z-index: 25;
    background: rgba(0, 0, 0, 0.5);
    border-radius: 10px;
    border: 3px solid black;
    filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.5));
    align-items: center;
    pointer-events: none;
    opacity: 0;
    transition: opacity 200ms ease-in-out;
    padding: 0 4px;
    bottom: -3px;

    &:before {
      content: " ";
      border: 10px solid transparent;
      width: 0;
      height: 0;
      border-left-color: black;
      position: absolute;
      margin-left: 2px;
      left: 100%;
    }
  }
}

.player.dead > .name {
  opacity: 0.5;
}

/***** Player menu *****/
.player > .menu {
  position: absolute;
  left: 110%;
  bottom: -5px;
  text-align: left;
  white-space: nowrap;
  background: rgba(0, 0, 0, 0.5);
  padding: 2px 5px;
  border-radius: 10px;
  border: 3px solid #000;
  margin-left: 15px;
  cursor: pointer;
  box-shadow: 0 0 5px rgba(0, 0, 0, 0.5);
  z-index: 50;

  &:before {
    content: " ";
    width: 0;
    height: 0;
    position: absolute;
    border: 10px solid transparent;
    border-right-color: black;
    right: 100%;
    bottom: 5px;
    margin-right: 2px;
  }

  li:hover {
    color: red;
  }

  li.disabled {
    cursor: not-allowed;
    opacity: 0.5;
    &:hover {
      color: white;
    }
  }

  svg {
    margin-right: 2px;
  }
}

/***** Ability text *****/
#townsquare.public .circle .ability {
  display: none;
}
.circle .player .shroud:hover ~ .token .ability,
.circle .player .token:hover .ability {
  opacity: 1;
}

/**** Night reminders ****/
.player .night-order {
  z-index: 5;
}

.player.dead .night-order em {
  color: #ddd;
  background: linear-gradient(180deg, rgba(0, 0, 0, 1) 0%, gray 100%);
}

.player.dead .emote em {
  color: #ddd;
  filter: sepia(40%);
  background: linear-gradient(180deg, rgba(0, 0, 0, 1) 0%, gray 100%);
}

/***** Reminder token *****/
.circle .reminder {
  background: url("../assets/reminder.png") center center;
  background-size: 100%;
  width: 50%;
  height: 0;
  padding-bottom: 50%;
  box-sizing: content-box;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 5px 0 0 -25%;
  border-radius: 50%;
  border: 3px solid black;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
  transition: all 200ms;
  cursor: pointer;

  .text {
    line-height: 90%;
    color: black;
    font-size: 50%;
    font-weight: bold;
    text-align: center;
    margin-top: 50%;
    height: 100%;
    width: 100%;
    position: absolute;
    top: 15%;
    text-shadow: 0 1px 1px #f6dfbd, 0 -1px 1px #f6dfbd, 1px 0 1px #f6dfbd,
      -1px 0 1px #f6dfbd;
  }

  .icon,
  &:after {
    content: " ";
    position: absolute;
    top: 0;
    width: 90%;
    height: 90%;
    background-size: 100%;
    background-position: center 0;
    background-repeat: no-repeat;
    background-image: url("../assets/icons/plus.png");
    transition: opacity 200ms;
  }

  &:after {
    background-image: url("../assets/icons/x.png");
    opacity: 0;
    top: 5%;
  }

  &.add {
    opacity: 0;
    top: 30px;
    &:after {
      display: none;
    }
    .icon {
      top: 5%;
    }
  }

  &.custom {
    .icon {
      display: none;
    }
    .text {
      font-size: 70%;
      word-break: break-word;
      margin-top: 0;
      display: flex;
      align-items: center;
      align-content: center;
      justify-content: center;
      border-radius: 50%;
      top: 0;
    }
  }

  &:hover:before {
    opacity: 0;
  }
  &:hover:after {
    opacity: 1;
  }
}

.circle .reminderHoverTarget {
  opacity: 0;
  width: calc(50% + 8px);
  padding-top: calc(50% + 38px);
  margin-top: calc(-25% - 33px);
  margin-left: calc(-25% - 1px);
  border-radius: 0 0 999px 999px;
  pointer-events: auto;
  transform: none !important;
  z-index: -1;
}

.circle li:hover .reminder.add {
  opacity: 1;
  top: 0;
}
.circle li:hover .reminder.add:before {
  opacity: 1;
}

#townsquare.public .reminder {
  opacity: 0;
  pointer-events: none;
}

/***** Point Vote tally *****/
.player .point-vote-voted {
  position: absolute;
  top: 2%;
  right: 2%;
  z-index: 6;
  color: gold;
  font-size: 120%;
  filter: drop-shadow(0 0 3px black);
  pointer-events: none;
}

.player .point-vote-tally {
  position: absolute;
  bottom: 20%;
  left: 50%;
  transform: translateX(-50%);
  z-index: 5;
  background: rgba(0, 0, 0, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 6px;
  padding: 2px 5px;
  text-align: center;
  pointer-events: none;
  width: 92%;

  .count {
    display: block;
    font-size: 90%;
    font-weight: bold;
    color: $townsfolk;
  }

  .voters {
    display: block;
    font-size: 60%;
    line-height: 1.3;
    color: white;
    word-break: break-word;
    white-space: normal;
  }
}

/***** Point Vote direction arrow *****/
.player .point-vote-arrow {
  position: absolute;
  width: 50%;
  height: 50%;
  top: -20%;
  left: 25%;
  z-index: 7;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  transform-origin: center center;
  transition: transform 300ms ease-out;

  // One Night reveal: a slower, deliberate swing towards the target
  &.revealing {
    transition: transform 770ms ease-in-out;
  }

  &.dimmed svg {
    opacity: 0.75;
  }

  &.own svg {
    color: #1aeb21;
  }

  svg {
    width: 70%;
    height: 70%;
    color: gold;
    filter: drop-shadow(0 0 3px black);
  }
}

/***** Point Vote leader highlight *****/
@keyframes point-vote-leader-glow {
  0%,
  100% {
    box-shadow: 0 0 8px 6px rgba(255, 215, 0, 0.7);
  }
  50% {
    box-shadow: 0 0 20px 10px rgba(255, 215, 0, 0.95);
  }
}

@keyframes point-vote-leader-glow-green {
  0%,
  100% {
    box-shadow: 0 0 8px 6px rgba(32, 197, 38, 0.7);
  }
  50% {
    box-shadow: 0 0 20px 10px rgba(76, 175, 80, 0.95);
  }
}

// Glow ring matches the token circle exactly (same as .alignment-overlay),
// sits above it at z-index 4 so mix-blend-mode never tints the colour.
.player.point-vote-leader::after,
.player.my-secret-vote::after,
.player.vote-reveal-current::after {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  aspect-ratio: 1 / 1;
  border-radius: 50%;
  z-index: 4;
  pointer-events: none;
  animation: point-vote-leader-glow 1.2s ease-in-out infinite;
}

.player.point-vote-leader.my-vote-leader::after,
.player.my-secret-vote::after {
  animation: point-vote-leader-glow-green 1.2s ease-in-out infinite;
}

/***** One Night vote reveal *****/
@keyframes vote-reveal-spotlight {
  0%,
  100% {
    box-shadow: 0 0 10px 6px rgba(255, 255, 255, 0.55);
  }
  50% {
    box-shadow: 0 0 26px 12px rgba(255, 255, 255, 0.95);
  }
}

.player.vote-reveal-current::after {
  animation: vote-reveal-spotlight 0.8s ease-in-out infinite;
}

@keyframes tally-pop {
  0% {
    transform: translateX(-50%) scale(1.4);
  }
  100% {
    transform: translateX(-50%) scale(1);
  }
}

.player .point-vote-tally.pop {
  animation: tally-pop 450ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
</style>
