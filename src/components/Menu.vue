<template>
  <div id="controls">
    <span
      class="victory-btn good"
      v-if="!session.isSpectator && session.sessionId"
      @click="openVictoryModal('good')"
      title="Declare Good Victory"
      >Good Wins</span
    >
    <span
      class="victory-btn evil"
      v-if="!session.isSpectator && session.sessionId"
      @click="openVictoryModal('evil')"
      title="Declare Evil Victory"
      >Evil Wins</span
    >
    <span
      class="nomlog-summary"
      v-show="session.voteHistory.length && session.sessionId"
      @click="toggleModal('voteHistory')"
      :title="
        `${session.voteHistory.length} recent ${
          session.voteHistory.length == 1 ? 'nomination' : 'nominations'
        }`
      "
    >
      <font-awesome-icon icon="book-dead" />
      {{ session.voteHistory.length }}
    </span>
    <span
      class="session"
      :class="{
        spectator: session.isSpectator,
        reconnecting: session.isReconnecting
      }"
      v-if="session.sessionId"
      @click="leaveSession"
      :title="
        `${session.playerCount} other players in this session${
          session.ping ? ' (' + session.ping + 'ms latency)' : ''
        }`
      "
    >
      <font-awesome-icon icon="broadcast-tower" />
      {{ session.playerCount }}
    </span>
    <div class="menu" :class="{ open: grimoire.isMenuOpen }">
      <font-awesome-icon icon="cog" @click="toggleMenu" />
      <ul>
        <li class="tabs" :class="tab">
          <font-awesome-icon icon="book-open" @click="tab = 'grimoire'" />
          <font-awesome-icon icon="broadcast-tower" @click="tab = 'session'" />
          <font-awesome-icon
            icon="users"
            v-if="!session.isSpectator"
            @click="tab = 'players'"
          />
          <font-awesome-icon icon="theater-masks" @click="tab = 'characters'" />
          <font-awesome-icon icon="question" @click="tab = 'help'" />
        </li>

        <template v-if="tab === 'grimoire'">
          <!-- Grimoire -->
          <li class="headline">Grimoire</li>
          <li @click="toggleGrimoire" v-if="players.length">
            <template v-if="!grimoire.isPublic">Hide</template>
            <template v-if="grimoire.isPublic">Show</template>
            <em>[G]</em>
          </li>
          <li @click="toggleNight" v-if="!session.isSpectator">
            <template v-if="!session.isNight">Switch to Night</template>
            <template v-if="session.isNight">Switch to Day</template>
            <em>[S]</em>
          </li>
          <li
            @click="toggleHiddenVoting"
            v-if="!session.isSpectator && !session.isOneNight"
          >
            <template v-if="!session.isHiddenVoting">Hide Voting</template>
            <template v-if="session.isHiddenVoting">Show Voting</template>
            <em>[H]</em>
          </li>
          <li @click="toggleReturnToTown" v-if="!session.isSpectator">
            <template v-if="!session.isReturnToTown">Return to Town</template>
            <template v-if="session.isReturnToTown">
              <l style="color: rgb(174, 174, 174)">
                <i>Gathering...</i>
              </l>
            </template>
            <em>[T]</em>
          </li>
          <li
            @click="togglePointVote"
            v-if="!session.isSpectator && players.length"
          >
            {{ pointVoteLabel }}
            <em>[P]</em>
          </li>
          <li @click="toggleNightOrder" v-if="players.length">
            Night order
            <em>
              <font-awesome-icon
                :icon="[
                  'fas',
                  grimoire.isNightOrder ? 'check-square' : 'square'
                ]"
              />
            </em>
          </li>
          <li v-if="!session.isSpectator && players.length" @click="rerack">
            Rerack
            <em><font-awesome-icon icon="redo-alt"/></em>
          </li>
          <li v-if="players.length">
            Zoom
            <em>
              <font-awesome-icon
                @click="setZoom(grimoire.zoom - 1)"
                icon="search-minus"
              />
              {{ Math.round(100 + grimoire.zoom * 10) }}%
              <font-awesome-icon
                @click="setZoom(grimoire.zoom + 1)"
                icon="search-plus"
              />
            </em>
          </li>
        </template>

        <template v-if="tab === 'session'">
          <!-- Session -->
          <li class="headline" v-if="session.sessionId">
            {{ session.isSpectator ? "Playing" : "Hosting" }}
          </li>
          <li class="headline" v-else>
            Live Session
          </li>
          <template v-if="!session.sessionId">
            <li @click="hostSession">Host (Storyteller)<em>[O]</em></li>
            <li @click="joinSession">Join (Player)<em>[J]</em></li>
          </template>
          <template v-else>
            <li v-if="session.ping">
              Delay to {{ session.isSpectator ? "host" : "players" }}
              <em>{{ session.ping }}ms</em>
            </li>
            <li @click="copySessionUrl">
              Copy player link
              <em><font-awesome-icon icon="copy"/></em>
            </li>
            <li v-if="!session.isSpectator" @click="distributeRoles">
              Send Characters
              <em><font-awesome-icon icon="theater-masks"/></em>
            </li>
            <li v-if="!session.isSpectator" @click="toggleOneNight">
              <template v-if="!session.isOneNight">
                Enable One Night Clocktower
              </template>
              <template v-else>Disable One Night Clocktower</template>
            </li>
            <li
              v-if="session.voteHistory.length || !session.isSpectator"
              @click="toggleModal('voteHistory')"
            >
              Vote history<em>[V]</em>
            </li>
            <li v-if="session.isOneNight" @click="toggleModal('leaderboard')">
              Leaderboard
              <em><font-awesome-icon icon="user-friends"/></em>
            </li>
            <li @click="leaveSession">
              Leave Session
              <em>{{ session.sessionId }}</em>
            </li>
          </template>
        </template>

        <template v-if="tab === 'players' && !session.isSpectator">
          <!-- Users -->
          <li class="headline">Players</li>
          <li @click="addPlayer" v-if="players.length < 20">Add<em>[A]</em></li>
          <li @click="randomizeSeatings" v-if="players.length > 2">
            Randomize
            <em><font-awesome-icon icon="dice"/></em>
          </li>
          <li @click="clearPlayers" v-if="players.length">
            Remove all
            <em><font-awesome-icon icon="trash-alt"/></em>
          </li>
        </template>

        <template v-if="tab === 'characters'">
          <!-- Characters -->
          <li class="headline">Characters</li>
          <li v-if="!session.isSpectator" @click="toggleModal('edition')">
            Select Edition
            <em>[E]</em>
          </li>
          <li
            @click="toggleModal('roles')"
            v-if="!session.isSpectator && players.length > 4"
          >
            Choose & Assign
            <em>[C]</em>
          </li>
          <li v-if="!session.isSpectator" @click="toggleModal('fabled')">
            Add Fabled & Loric
            <em><font-awesome-icon icon="dragon"/></em>
          </li>
          <li @click="toggleModal('reference')">
            Reference Sheet
            <em>[R]</em>
          </li>
          <li @click="toggleModal('nightOrder')">
            Night Order Sheet
            <em>[N]</em>
          </li>
          <li @click="clearRoles" v-if="players.length">
            Remove all
            <em><font-awesome-icon icon="trash-alt"/></em>
          </li>
        </template>

        <template v-if="tab === 'help'">
          <!-- Help -->
          <li class="headline">Help</li>
          <li @click="setBackground">
            Background image
            <em><font-awesome-icon icon="image"/></em>
          </li>
          <li v-if="!edition.isOfficial" @click="imageOptIn">
            <small>Show Custom Images</small>
            <em
              ><font-awesome-icon
                :icon="[
                  'fas',
                  grimoire.isImageOptIn ? 'check-square' : 'square'
                ]"
            /></em>
          </li>
          <li @click="toggleStatic">
            Disable Animations
            <em
              ><font-awesome-icon
                :icon="['fas', grimoire.isStatic ? 'check-square' : 'square']"
            /></em>
          </li>
          <li @click="toggleMuted">
            Mute Sounds
            <em
              ><font-awesome-icon
                :icon="['fas', grimoire.isMuted ? 'volume-mute' : 'volume-up']"
            /></em>
          </li>
          <li @click="toggleModal('gameState')">
            Game State JSON
            <em><font-awesome-icon icon="file-code"/></em>
          </li>
          <li>
            <a href="https://discord.gg/Gd7ybwWbFk" target="_blank">
              Join Discord
            </a>
            <em>
              <a href="https://discord.gg/Gd7ybwWbFk" target="_blank">
                <font-awesome-icon :icon="['fab', 'discord']" />
              </a>
            </em>
          </li>
          <li>
            <a href="https://github.com/bra1n/townsquare" target="_blank">
              Source code
            </a>
            <em>
              <a href="https://github.com/bra1n/townsquare" target="_blank">
                <font-awesome-icon :icon="['fab', 'github']" />
              </a>
            </em>
          </li>
        </template>
      </ul>
    </div>
    <div id="audioGong" class="playGong" v-if="session.isReturnToTown">
      <audio
        :autoplay="!grimoire.isMuted"
        :src="$event.returnToTownSound"
        :muted="grimoire.isMuted"
      ></audio>
    </div>
  </div>
</template>

<script>
import { mapGetters, mapMutations, mapState } from "vuex";

export default {
  computed: {
    ...mapState(["grimoire", "session", "edition"]),
    ...mapState("players", ["players"]),
    ...mapGetters({ pointVoteName: "session/pointVoteName" }),
    pointVoteLabel() {
      const name = this.pointVoteName;
      return this.session.pointVoteActive ? `End ${name}` : name;
    }
  },
  data() {
    return {
      tab: "grimoire"
    };
  },
  methods: {
    setBackground() {
      const background = prompt("Enter custom background URL");
      if (background || background === "") {
        this.$store.commit("setBackground", background);
      }
    },
    hostSession() {
      if (this.session.sessionId) return;
      const sessionId = prompt(
        "Enter a channel number / name for your session",
        Math.round(Math.random() * 10000)
      );
      if (sessionId) {
        this.$store.commit("session/clearVoteHistory");
        this.$store.commit("session/setVoteHistoryAllowed", false);
        this.$store.commit("session/setSpectator", false);
        this.$store.commit("session/setSessionId", sessionId);
        this.copySessionUrl();
      }
    },
    copySessionUrl() {
      const url = window.location.href.split("#")[0];
      const link = url + "#" + this.session.sessionId;
      navigator.clipboard.writeText(link);
    },
    distributeRoles() {
      if (this.session.isSpectator) return;
      const popup =
        "Do you want to distribute assigned characters to all SEATED players?";
      if (confirm(popup)) {
        // One Night: a new game drops the previous game's votes and skulls
        if (this.session.isOneNight) {
          this.$store.commit("session/setOneNightVotes", null);
          this.$store.commit("session/setMarkedPlayer", -1);
          this.$store.commit("leaderboard/startGame");
        }
        this.$store.commit("session/distributeRoles", true);
        setTimeout(
          (() => {
            this.$store.commit("session/distributeRoles", false);
          }).bind(this),
          2000
        );
      }
    },
    imageOptIn() {
      const popup =
        "Are you sure you want to allow custom images? A malicious script file author might track your IP address this way.";
      if (this.grimoire.isImageOptIn || confirm(popup)) {
        this.toggleImageOptIn();
      }
    },
    joinSession() {
      if (this.session.sessionId) return this.leaveSession();
      let sessionId = prompt(
        "Enter the channel number / name of the session you want to join"
      );
      if (sessionId.match(/^https?:\/\//i)) {
        sessionId = sessionId.split("#").pop();
      }
      if (sessionId) {
        this.$store.commit("session/clearVoteHistory");
        this.$store.commit("session/setSpectator", true);
        this.$store.commit("toggleGrimoire", false);
        this.$store.commit("session/setSessionId", sessionId);
      }
    },
    openVictoryModal(team) {
      this.$store.commit("session/setVictoryModalTeam", team);
    },
    leaveSession() {
      if (confirm("Are you sure you want to leave the active live game?")) {
        // One Night came from the host's game; don't carry it into the next.
        // Done while still a player, so the ST's saved setting is untouched.
        if (this.session.isSpectator && this.session.isOneNight) {
          this.$store.commit("session/toggleOneNight", false);
        }
        this.$store.commit("session/setSpectator", false);
        this.$store.commit("session/setSessionId", "");
      }
    },
    addPlayer() {
      if (this.session.isSpectator) return;
      if (this.players.length >= 20) return;
      const name = prompt("Player name");
      if (name) {
        this.$store.commit("players/add", name);
      }
    },
    randomizeSeatings() {
      if (this.session.isSpectator) return;
      if (confirm("Are you sure you want to randomize seatings?")) {
        this.$store.dispatch("players/randomize");
      }
    },
    clearPlayers() {
      if (this.session.isSpectator) return;
      if (confirm("Are you sure you want to remove all players?")) {
        // abort vote if in progress
        if (this.session.nomination) {
          this.$store.commit("session/nomination");
        }
        this.$store.commit("players/clear");
      }
    },
    clearRoles() {
      if (confirm("Are you sure you want to remove all player roles?")) {
        this.$store.dispatch("players/clearRoles");
        this.$store.commit("players/resetAllAlignments");
        Object.keys(localStorage)
          .filter(k => k.startsWith("localAlignment_"))
          .forEach(k => localStorage.removeItem(k));
        // and from the tokens already on screen (they only read storage when
        // they first appear); this screen only, never sent to anyone else
        this.$store.commit("session/resetSelfAlignments");
      }
    },
    toggleNight() {
      //Prompt the ST if they switch directly from Hidden Voting to Night
      //If it's already hidden voting, it's not Night.
      if (this.session.isHiddenVoting) {
        if (this.session.isNight) {
          this.$store.commit("session/toggleNight");
        } else {
          if (confirm("Are you sure you want to un-hide voting?")) {
            this.$store.commit("session/toggleHiddenVoting");
            this.$store.commit("session/toggleNight");
            this.$store.commit("session/addNightSeparator");
            this.$store.commit("session/setMarkedPlayer", -1);
            this.players.forEach(player => {
              this.$store.commit("players/update", {
                player,
                property: "handRaised",
                value: false
              });
            });
          }
        }
      } else {
        this.$store.commit("session/toggleNight");
        if (this.session.isNight) {
          this.$store.commit("session/addNightSeparator");
          this.$store.commit("session/setMarkedPlayer", -1);
          this.players.forEach(player => {
            this.$store.commit("players/update", {
              player,
              property: "handRaised",
              value: false
            });
          });
        }
      }
    },
    toggleHiddenVoting() {
      if (this.session.isHiddenVoting) {
        if (confirm("Are you sure you want to un-hide voting?")) {
          this.$store.commit("session/toggleHiddenVoting");
        }
      } else {
        //Hidden voting ends the night
        this.$store.commit("session/toggleHiddenVoting");
        this.$store.commit("session/toggleNight", false);
      }
    },
    toggleOneNight() {
      if (this.session.isOneNight) {
        if (confirm("Are you sure you want to disable One Night Clocktower?")) {
          // close any vote still running under the One Night rules
          this.closePointVote();
          // an unrevealed Secret Point Vote must never reach players once the
          // mode stops masking it
          if (!this.session.pointVoteRevealed) {
            this.$store.commit("session/setPointVotes", {});
            this.$store.commit("session/setMarkedPlayer", -1);
          }
          this.$store.commit("session/toggleOneNight", false);
        }
      } else {
        // start clean: no open vote, and Hide Voting can't be switched off in
        // the mode (its menu item and [H] are hidden)
        this.closePointVote();
        if (this.session.isHiddenVoting) {
          this.$store.commit("session/toggleHiddenVoting", false);
        }
        this.$store.commit("session/toggleOneNight", true);
      }
    },
    /**
     * Rerack (ST): close the last game and reset the town for the next one.
     * Players stay seated and Fabled & Loric stay; Send Characters still
     * starts the next game.
     */
    rerack() {
      if (this.session.isSpectator) return;
      if (
        !confirm(
          "Rerack the town? This clears every character, reminder, " +
            "alignment, death and mark, for you and every seated player. " +
            "Fabled & Loric stay, and players stay seated in a shuffled order."
        )
      ) {
        return;
      }
      const { commit, dispatch } = this.$store;
      // close anything still running from the last game
      if (this.session.nomination) commit("session/nomination");
      this.closePointVote();
      commit("session/setPointVotes", {});
      commit("session/setVictoryModalTeam", null);
      commit("session/clearVictory");
      commit("session/clearVictoryReveal");
      // every seat back to blank and shuffled, no skull marks or saved votes
      dispatch("players/rerack");
      dispatch("players/randomize");
      commit("session/setMarkedPlayer", -1);
      commit("session/setOneNightVotes", null);
      // back to Day, without Hide Voting, with a fresh vote history
      if (this.session.isHiddenVoting) {
        commit("session/toggleHiddenVoting", false);
      }
      if (this.session.isNight) commit("session/toggleNight", false);
      commit("session/clearVoteHistory");
      // tell every seated player to clear their own character and notes
      commit("session/startRerack");
      // next step: choose the new characters (that window needs 5 players)
      if (this.$store.getters["players/nonTravelers"] >= 5) {
        if (!this.$store.state.modals.roles) this.toggleModal("roles");
      } else {
        commit(
          "session/showNotice",
          "Town reset. Choose characters, then Send Characters."
        );
      }
      this.toggleMenu();
    },
    closePointVote() {
      if (this.session.pointVoteActive) {
        this.$store.commit("session/setPointVoteActive", false);
      }
      if (this.session.pointVoteEnded) {
        this.$store.commit("session/setPointVoteEnded", false);
      }
    },
    toggleReturnToTown() {
      //Play the animation for a set duration, along with the audio.
      if (!this.session.isReturnToTown) {
        this.$store.commit("session/toggleReturnToTown");
        setTimeout(() => {
          this.$store.commit("session/toggleReturnToTown");
        }, this.$event.returnToTownDuration);
      }
    },
    togglePointVote() {
      if (this.session.pointVoteActive) {
        this.$store.commit("session/setPointVoteActive", false);
      } else {
        // abort any active nomination before starting point vote
        if (this.session.nomination) {
          this.$store.commit("session/nomination");
        }
        // a new Secret Point Vote clears the last one's skulls
        if (this.session.isOneNight) {
          this.$store.commit("session/setMarkedPlayer", -1);
        }
        this.$store.commit("session/setPointVoteActive", true);
      }
      this.toggleMenu();
    },
    ...mapMutations([
      "toggleGrimoire",
      "toggleMenu",
      "toggleImageOptIn",
      "toggleMuted",
      "toggleNightOrder",
      "toggleStatic",
      "setZoom",
      "toggleModal"
    ])
  }
};
</script>

<style scoped lang="scss">
@import "../vars.scss";

// success animation
@keyframes greenToWhite {
  from {
    color: green;
  }
  to {
    color: white;
  }
}

// Controls
#controls {
  position: absolute;
  right: 3px;
  top: 3px;
  text-align: right;
  padding-right: 50px;
  z-index: 75;

  svg {
    filter: drop-shadow(0 0 5px rgba(0, 0, 0, 1));
    &.success {
      animation: greenToWhite 1s normal forwards;
      animation-iteration-count: 1;
    }
  }

  > span {
    display: inline-block;
    cursor: pointer;
    z-index: 5;
    margin-top: 7px;
    margin-left: 10px;
  }

  span.nomlog-summary {
    color: $townsfolk;
  }

  span.session {
    color: $demon;
    &.spectator {
      color: $townsfolk;
    }
    &.reconnecting {
      animation: blink 1s infinite;
    }
  }

  span.victory-btn {
    cursor: pointer;
    font-size: 13px;
    font-weight: bold;
    padding: 2px 7px;
    border-radius: 4px;
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.9);
    transition: opacity 200ms ease;
    &:hover {
      opacity: 0.75;
    }
    &.good {
      color: #4da6ff;
    }
    &.evil {
      color: #e03030;
    }
  }
}

@keyframes blink {
  50% {
    opacity: 0.5;
    color: gray;
  }
}

.menu {
  width: 220px;
  transform-origin: 200px 22px;
  transition: transform 500ms cubic-bezier(0.68, -0.55, 0.27, 1.55);
  transform: rotate(-90deg);
  position: absolute;
  right: 0;
  top: 0;

  &.open {
    transform: rotate(0deg);
  }

  > svg {
    cursor: pointer;
    background: rgba(0, 0, 0, 0.5);
    border: 3px solid black;
    width: 40px;
    height: 50px;
    margin-bottom: -8px;
    border-bottom: 0;
    border-radius: 10px 10px 0 0;
    padding: 5px 5px 15px;
  }

  a {
    color: white;
    text-decoration: none;
    &:hover {
      color: red;
    }
  }

  ul {
    display: flex;
    list-style-type: none;
    padding: 0;
    margin: 0;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 0 10px black;
    border: 3px solid black;
    border-radius: 10px 0 10px 10px;

    li {
      padding: 2px 5px;
      color: white;
      text-align: left;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-height: 30px;

      &.tabs {
        display: flex;
        padding: 0;
        svg {
          flex-grow: 1;
          flex-shrink: 0;
          height: 35px;
          border-bottom: 3px solid black;
          border-right: 3px solid black;
          padding: 5px 0;
          cursor: pointer;
          transition: color 250ms;
          &:hover {
            color: red;
          }
          &:last-child {
            border-right: 0;
          }
        }
        &.grimoire .fa-book-open,
        &.players .fa-users,
        &.characters .fa-theater-masks,
        &.session .fa-broadcast-tower,
        &.help .fa-question {
          background: linear-gradient(
            to bottom,
            $townsfolk 0%,
            rgba(0, 0, 0, 0.5) 100%
          );
        }
      }

      &:not(.headline):not(.tabs):hover {
        cursor: pointer;
        color: red;
      }

      em {
        flex-grow: 0;
        font-style: normal;
        margin-left: 10px;
        font-size: 80%;
      }
    }

    .headline {
      font-family: PiratesBay, sans-serif;
      letter-spacing: 1px;
      padding: 0 10px;
      text-align: center;
      justify-content: center;
      background: linear-gradient(
        to right,
        $townsfolk 0%,
        rgba(0, 0, 0, 0.5) 20%,
        rgba(0, 0, 0, 0.5) 80%,
        $demon 100%
      );
    }
  }
}
</style>
