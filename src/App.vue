<template>
  <div
    id="app"
    @keyup="keyup"
    tabindex="-1"
    :class="[
      {
        night: session.isNight,
        static: grimoire.isStatic,
        hiddenVoting: session.isHiddenVoting,
        returnToTown: session.isReturnToTown
      },
      $event.name !== 'default' ? 'event-' + $event.name : ''
    ]"
    :style="{
      backgroundImage: randomBackground
        ? `url('${randomBackground}')`
        : grimoire.background
        ? `url('${grimoire.background}')`
        : ''
    }"
  >
    <video
      id="background"
      v-if="grimoire.background && grimoire.background.match(/\.(mp4|webm)$/i)"
      :src="grimoire.background"
      autoplay
      loop
    ></video>
    <div class="backdrop"></div>
    <div class="event-overlay"></div>
    <div class="diseasecloud"></div>
    <div class="returnCircle"></div>
    <transition name="blur">
      <Intro v-if="!players.length"></Intro>
      <TownInfo
        v-if="
          players.length &&
            !session.nomination &&
            !session.pointVoteActive &&
            !session.pointVoteEnded
        "
      ></TownInfo>
      <Vote v-if="session.nomination"></Vote>
      <PointVote
        v-if="session.pointVoteActive || session.pointVoteEnded"
      ></PointVote>
    </transition>
    <TownSquare></TownSquare>
    <TownNotice />
    <Menu ref="menu"></Menu>
    <EditionModal />
    <FabledModal />
    <RolesModal />
    <ReferenceModal />
    <NightOrderModal />
    <VoteHistoryModal />
    <LeaderboardModal />
    <GameStateModal />
    <Gradients />
    <VictoryCelebration />
    <VictoryModal />
    <VictoryReveal />
    <span id="version">v{{ version }}</span>
  </div>
</template>

<script>
import { mapState } from "vuex";
import { version } from "../package.json";
import TownSquare from "./components/TownSquare";
import TownInfo from "./components/TownInfo";
import TownNotice from "./components/TownNotice";
import Menu from "./components/Menu";
import RolesModal from "./components/modals/RolesModal";
import EditionModal from "./components/modals/EditionModal";
import Intro from "./components/Intro";
import ReferenceModal from "./components/modals/ReferenceModal";
import Vote from "./components/Vote";
import PointVote from "./components/PointVote";
import Gradients from "./components/Gradients";
import NightOrderModal from "./components/modals/NightOrderModal";
import FabledModal from "@/components/modals/FabledModal";
import VoteHistoryModal from "@/components/modals/VoteHistoryModal";
import LeaderboardModal from "@/components/modals/LeaderboardModal";
import GameStateModal from "@/components/modals/GameStateModal";
import VictoryCelebration from "./components/VictoryCelebration";
import VictoryModal from "./components/VictoryModal";
import VictoryReveal from "./components/VictoryReveal";

// Single recursive context covers all event subfolders — no changes needed here for new events.
const allBackgrounds = require.context("./assets/backgrounds", true, /\.jpg$/i);

export default {
  components: {
    GameStateModal,
    VoteHistoryModal,
    LeaderboardModal,
    VictoryCelebration,
    VictoryModal,
    VictoryReveal,
    FabledModal,
    NightOrderModal,
    Vote,
    PointVote,
    ReferenceModal,
    Intro,
    TownInfo,
    TownNotice,
    TownSquare,
    Menu,
    EditionModal,
    RolesModal,
    Gradients
  },
  data() {
    return {
      version,
      randomBackground: null
    };
  },
  computed: {
    ...mapState(["grimoire", "session"]),
    ...mapState("players", ["players"])
  },
  created() {
    const folder = this.$event.backgroundsFolder;
    const bgImages = allBackgrounds
      .keys()
      .filter(key =>
        folder ? key.startsWith(`./${folder}/`) : !key.slice(2).includes("/")
      );
    if (bgImages.length) {
      const randomIndex = Math.floor(Math.random() * bgImages.length);
      this.randomBackground = allBackgrounds(bgImages[randomIndex]);
    }
  },
  methods: {
    keyup({ key, ctrlKey, metaKey }) {
      if (ctrlKey || metaKey) return;
      switch (key.toLocaleLowerCase()) {
        case "g":
          this.$store.commit("toggleGrimoire");
          break;
        case "a":
          this.$refs.menu.addPlayer();
          break;
        case "o":
          this.$refs.menu.hostSession();
          break;
        case "j":
          this.$refs.menu.joinSession();
          break;
        case "r":
          this.$store.commit("toggleModal", "reference");
          break;
        case "n":
          this.$store.commit("toggleModal", "nightOrder");
          break;
        case "e":
          if (this.session.isSpectator) return;
          this.$store.commit("toggleModal", "edition");
          break;
        case "c":
          if (this.session.isSpectator) return;
          this.$store.commit("toggleModal", "roles");
          break;
        case "h":
          if (this.session.isSpectator) return;
          if (this.session.isOneNight) return;
          this.$refs.menu.toggleHiddenVoting();
          break;
        case "t":
          if (this.session.isSpectator) return;
          this.$refs.menu.toggleReturnToTown();
          break;
        case "v":
          if (this.session.voteHistory.length || !this.session.isSpectator) {
            this.$store.commit("toggleModal", "voteHistory");
          }
          break;
        case "s":
          if (this.session.isSpectator) return;
          this.$refs.menu.toggleNight();
          break;
        case "p":
          if (this.session.isSpectator) return;
          if (!this.players.length) return;
          if (this.session.nomination) return;
          this.$refs.menu.togglePointVote();
          break;
        case "escape":
          this.$store.commit("toggleModal");
      }
    }
  }
};
</script>

<style lang="scss">
@import "vars";

@font-face {
  font-family: "Papyrus";
  src: url("assets/fonts/papyrus.eot"); /* IE9*/
  src: url("assets/fonts/papyrus.eot?#iefix") format("embedded-opentype"),
    /* IE6-IE8 */ url("assets/fonts/papyrus.woff2") format("woff2"),
    /* chrome firefox */ url("assets/fonts/papyrus.woff") format("woff"),
    /* chrome firefox */ url("assets/fonts/papyrus.ttf") format("truetype"),
    /* chrome firefox opera Safari, Android, iOS 4.2+*/
      url("assets/fonts/papyrus.svg#PapyrusW01") format("svg"); /* iOS 4.1- */
}

@font-face {
  font-family: PiratesBay;
  src: url("assets/fonts/piratesbay.ttf");
  font-display: swap;
}

html,
body {
  font-size: 1.2em;
  line-height: 1.4;
  background-size: cover;
  color: white;
  height: 100%;
  font-family: "Roboto Condensed", sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  padding: 0;
  margin: 0;
  overflow: hidden;
}

@import "media";

* {
  box-sizing: border-box;
  position: relative;
}

a {
  color: $townsfolk;
  &:hover {
    color: $demon;
  }
}

h1,
h2,
h3,
h4,
h5 {
  margin: 0;
  text-align: center;
  font-family: PiratesBay, sans-serif;
  letter-spacing: 1px;
  font-weight: normal;
}

ul {
  list-style-type: none;
  margin: 0;
  padding: 0;
}

#app {
  height: 100%;
  background-position: center center;
  background-size: cover;
  display: flex;
  align-items: center;
  align-content: center;
  justify-content: center;

  // disable all animations
  &.static *,
  &.static *:after,
  &.static *:before {
    transition: none !important;
    animation: none !important;
  }
}

#version {
  position: absolute;
  text-align: right;
  right: 10px;
  bottom: 10px;
  font-size: 60%;
  opacity: 0.5;
}

.blur-enter-active,
.blur-leave-active {
  transition: all 250ms;
  filter: blur(0);
}
.blur-enter,
.blur-leave-to {
  opacity: 0;
  filter: blur(20px);
}

// Buttons
.button-group {
  display: flex;
  align-items: center;
  justify-content: center;
  align-content: center;
  .button {
    margin: 5px 0;
    border-radius: 0;
    &:first-child {
      border-top-left-radius: 15px;
      border-bottom-left-radius: 15px;
    }
    &:last-child {
      border-top-right-radius: 15px;
      border-bottom-right-radius: 15px;
    }
  }
}
.button {
  padding: 0;
  border: solid 0.125em transparent;
  border-radius: 15px;
  box-shadow: inset 0 1px 1px #9c9c9c, 0 0 10px #000;
  background: radial-gradient(
        at 0 -15%,
        rgba(#fff, 0.07) 70%,
        rgba(#fff, 0) 71%
      )
      0 0/ 80% 90% no-repeat content-box,
    linear-gradient(#4e4e4e, #040404) content-box,
    linear-gradient(#292929, #010101) border-box;
  color: white;
  font-weight: bold;
  text-shadow: 1px 1px rgba(0, 0, 0, 0.5);
  line-height: 170%;
  margin: 5px auto;
  cursor: pointer;
  transition: all 200ms;
  white-space: nowrap;
  &:hover {
    color: red;
  }
  &.disabled {
    color: gray;
    cursor: default;
    opacity: 0.75;
  }
  &:before,
  &:after {
    content: " ";
    display: inline-block;
    width: 10px;
    height: 10px;
  }
  &.townsfolk {
    background: radial-gradient(
          at 0 -15%,
          rgba(255, 255, 255, 0.07) 70%,
          rgba(255, 255, 255, 0) 71%
        )
        0 0/80% 90% no-repeat content-box,
      linear-gradient(#0031ad, rgba(5, 0, 0, 0.22)) content-box,
      linear-gradient(#292929, #001142) border-box;
    box-shadow: inset 0 1px 1px #002c9c, 0 0 10px #000;
    &:hover:not(.disabled) {
      color: #008cf7;
    }
  }
  &.demon {
    background: radial-gradient(
          at 0 -15%,
          rgba(255, 255, 255, 0.07) 70%,
          rgba(255, 255, 255, 0) 71%
        )
        0 0/80% 90% no-repeat content-box,
      linear-gradient(#ad0000, rgba(5, 0, 0, 0.22)) content-box,
      linear-gradient(#292929, #420000) border-box;
    box-shadow: inset 0 1px 1px #9c0000, 0 0 10px #000;
  }
}

/* Reminder token alignment overlay — shared by Player.vue and ReminderModal.vue */
.reminder-alignment-overlay {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  pointer-events: none;
  mix-blend-mode: color;
  z-index: 2;
  &.good {
    background: rgba(40, 110, 255, 0.85);
  }
}

/* video background */
video#background {
  position: absolute;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Seasonal event overlay — base (hidden by default) */
#app > .event-overlay {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  top: 0;
  pointer-events: none;
  opacity: 0;
  transition: opacity 1s ease-in-out;
}

/* Christmas: suppress normal night backdrop so clouds don't bleed through during fade */
#app.event-xmas.night > .backdrop {
  opacity: 0;
}

/* Christmas: visual content always present so opacity transition has something to fade */
#app.event-xmas > .event-overlay {
  background: black;
  background: linear-gradient(
    180deg,
    rgba(0, 0, 0, 1) 0%,
    rgba(1, 22, 46, 1) 50%,
    rgba(0, 39, 70, 1) 100%
  );
  &:after {
    content: " ";
    display: block;
    width: 100%;
    height: 100%;
    background: url("assets/snow.png");
    background-repeat: repeat;
    background-size: auto 2000px;
    background-position: 0 0;
    animation: scroll-snow 30s linear infinite;
    opacity: 0.6;
    pointer-events: none;
  }
}

/* Christmas: night only — reveal the overlay */
#app.event-xmas.night > .event-overlay {
  opacity: 0.8;
}

@keyframes scroll-snow {
  from {
    background-position: 0 0;
  }
  to {
    background-position: 0 1200px;
  }
}

/* Night phase backdrop */
#app > .backdrop {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  top: 0;
  pointer-events: none;
  background: black;
  background: linear-gradient(
    180deg,
    rgba(0, 0, 0, 1) 0%,
    rgba(1, 22, 46, 1) 50%,
    rgba(0, 39, 70, 1) 100%
  );
  opacity: 0;
  transition: opacity 1s ease-in-out;
  &:after {
    content: " ";
    display: block;
    width: 100%;
    padding-right: 2000px;
    height: 100%;
    background: url("assets/clouds.png") repeat;
    background-size: 2000px auto;
    animation: move-background 120s linear infinite;
    opacity: 0.3;
  }
}

@keyframes move-background {
  from {
    transform: translate3d(-2000px, 0px, 0px);
  }
  to {
    transform: translate3d(0px, 0px, 0px);
  }
}

#app.night > .backdrop {
  opacity: 0.5;
}

/* Hidden Voting Disease Cloud */
#app > .diseasecloud {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  top: 0;
  pointer-events: none;
  background: black;
  background: linear-gradient(
    180deg,
    rgb(143, 176, 143) 0%,
    rgb(46, 75, 47) 50%,
    rgb(8, 32, 11) 100%
  );
  opacity: 0;
  transition: opacity 1s ease-in-out;
  &:after {
    content: " ";
    display: block;
    width: 100%;
    padding-left: 2000px;
    height: 100%;
    background: url("assets/splatter.png") repeat;
    background-size: 2000px auto;
    animation: move-diseasecloud 45s linear infinite;
    opacity: 0.2;
  }
}

@keyframes move-diseasecloud {
  from {
    transform: translate3d(0px, 0px, 0px);
  }
  to {
    transform: translate3d(-2000px, 0px, 0px);
  }
}

#app.hiddenVoting > .diseasecloud {
  opacity: 0.6;
}

/* Return to Town */
#app > .returnCircle {
  position: absolute;
  align-items: center;
  align-content: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  z-index: 30;
  pointer-events: none;
  transition: opacity 1s ease-in-out;
  background: url("assets/returntotown.png") center center no-repeat;
  opacity: 0;
  background-size: auto 52%;
  animation: move-returnCircle 12s linear infinite;
}

@keyframes move-returnCircle {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

#app.returnToTown > .returnCircle {
  opacity: 1;
}
</style>
