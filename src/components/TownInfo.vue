<template>
  <ul class="info">
    <!-- One Night mode replaces the script logo; the script name stays below -->
    <li class="edition one-night" v-if="session.isOneNight">
      <span class="one-night-title">One Night</span>
      <span class="one-night-subtitle">Ultimate Clocktower</span>
      <span class="one-night-rules">
        <span>No nominations · No private chats</span>
        <span>Everyone votes at the end of Day 1</span>
      </span>
    </li>
    <li
      v-else
      class="edition"
      :class="['edition-' + edition.id]"
      :style="{
        backgroundImage: `url(${
          edition.logo && grimoire.isImageOptIn
            ? edition.logo
            : require('../assets/editions/' + edition.id + '.png')
        })`
      }"
    ></li>
    <li v-if="players.length - teams.traveler < 5">
      Please add more players!
    </li>
    <li>
      <!-- the One Night banner hides the logo, so name official scripts too -->
      <span class="meta" v-if="!edition.isOfficial || session.isOneNight">
        {{ edition.name }}
        {{ edition.author ? "by " + edition.author : "" }}
      </span>
      <span>
        {{ players.length }} <font-awesome-icon class="players" icon="users" />
      </span>
      <span>
        {{ teams.alive }}
        <font-awesome-icon class="alive" icon="heartbeat" />
      </span>
      <span>
        {{ teams.votes }} <font-awesome-icon class="votes" icon="vote-yea" />
      </span>
    </li>
    <li v-if="players.length - teams.traveler >= 5">
      <span>
        {{ teams.townsfolk }}
        <font-awesome-icon class="townsfolk" icon="user-friends" />
      </span>
      <span>
        {{ teams.outsider }}
        <font-awesome-icon
          class="outsider"
          :icon="teams.outsider > 1 ? 'user-friends' : 'user'"
        />
      </span>
      <span>
        {{ teams.minion }}
        <font-awesome-icon
          class="minion"
          :icon="teams.minion > 1 ? 'user-friends' : 'user'"
        />
      </span>
      <span>
        {{ teams.demon }}
        <font-awesome-icon
          class="demon"
          :icon="teams.demon > 1 ? 'user-friends' : 'user'"
        />
      </span>
      <span v-if="teams.traveler">
        {{ teams.traveler }}
        <font-awesome-icon
          class="traveler"
          :icon="teams.traveler > 1 ? 'user-friends' : 'user'"
        />
      </span>
      <span v-if="session.isNight">
        Night phase
        <font-awesome-icon :icon="['fas', 'cloud-moon']" />
      </span>
      <span v-if="session.isHiddenVoting">
        Hidden Voting
        <font-awesome-icon :icon="['fas', 'eye-slash']" />
      </span>
    </li>
  </ul>
</template>

<script>
import gameJSON from "./../game";
import { mapState } from "vuex";
import { oneNightComposition } from "@/utils/oneNight";

export default {
  computed: {
    teams: function() {
      const { players } = this.$store.state.players;
      const nonTravelers = this.$store.getters["players/nonTravelers"];
      const alive = players.filter(player => player.isDead !== true).length;
      const base = gameJSON[nonTravelers - 5];
      return {
        ...(this.session.isOneNight ? oneNightComposition(base) : base),
        traveler: players.length - nonTravelers,
        alive,
        votes:
          alive +
          players.filter(
            player => player.isDead === true && player.isVoteless !== true
          ).length
      };
    },
    ...mapState(["edition", "grimoire", "session"]),
    ...mapState("players", ["players"])
  }
};
</script>

<style lang="scss" scoped>
@import "../vars.scss";

.info {
  position: absolute;
  display: flex;
  width: 20%;
  height: 20%;
  padding: 50px 0 0;
  align-items: center;
  align-content: center;
  justify-content: center;
  flex-wrap: wrap;
  background: url("../assets/demon-head.png") center center no-repeat;
  background-size: auto 100%;

  li {
    font-weight: bold;
    width: 100%;
    filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.7));
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    text-shadow: 0 2px 1px black, 0 -2px 1px black, 2px 0 1px black,
      -2px 0 1px black;

    span {
      white-space: nowrap;
    }

    .meta {
      text-align: center;
      flex-basis: 100%;
      font-family: PiratesBay, sans-serif;
      font-weight: normal;
    }

    svg {
      margin-right: 10px;
    }

    .players {
      color: #00f700;
    }
    .alive {
      color: #ff4a50;
    }
    .votes {
      color: #fff;
    }
    .townsfolk {
      color: $townsfolk;
    }
    .outsider {
      color: $outsider;
    }
    .minion {
      color: $minion;
    }
    .demon {
      color: $demon;
    }
    .traveler {
      color: $traveler;
    }
  }

  li.edition {
    width: 220px;
    height: 200px;
    max-width: 100%;
    max-height: 100%;
    background-position: 0 center;
    background-repeat: no-repeat;
    background-size: 100% auto;
    position: absolute;
    top: -25%;

    &.one-night {
      flex-direction: column;
      flex-wrap: nowrap;
      align-items: center;
      justify-content: center;
      text-align: center;
      line-height: 1.1;
      // lift the banner clear of the script name line below it
      transform: translateY(-50px);

      .one-night-title {
        font-family: "Papyrus", serif;
        font-size: 260%;
        color: gold;
      }

      .one-night-subtitle {
        font-family: "Papyrus", serif;
        font-size: 150%;
        color: gold;
      }

      .one-night-rules {
        margin-top: 6px;
        font-size: 70%;
        font-weight: normal;
        opacity: 0.9;

        // two fixed lines, each kept whole
        span {
          display: block;
          white-space: nowrap;
        }
      }
    }
  }
}
</style>
