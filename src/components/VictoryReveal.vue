<template>
  <transition name="reveal-fade">
    <div v-if="isVisible" class="grimoire-reveal-overlay" :class="winningTeam">
      <div class="reveal-header">
        <span class="reveal-title">
          {{ winningTeam === "good" ? "Good Wins!" : "Evil Wins!" }}
        </span>
        <span class="reveal-phase" v-if="!allRevealed">Revealing...</span>
        <span class="reveal-points-caption" v-if="pointsVisible">
          Points scored
        </span>
      </div>

      <div class="reveal-particle-layer" aria-hidden="true">
        <span
          v-for="i in 40"
          :key="'p' + i"
          class="rp"
          :style="particleStyle(i)"
        ></span>
      </div>

      <div class="reveal-town">
        <div class="button demon reveal-close-btn" @click="dismiss">Close</div>
        <div
          v-for="(player, i) in snapshotPlayers"
          :key="i"
          class="reveal-player"
          :class="{
            revealed: isRevealed(i),
            winner: isRevealed(i) && isWinner(i),
            dead: player.isDead,
            'evil-reveal':
              isRevealed(i) && effectiveAlignment(player) === 'evil',
            'final-pair-shaking':
              finalPairShaking && finalPairIndices.includes(i),
            'final-pair-revealed':
              finalPairRevealed && finalPairIndices.includes(i)
          }"
          :style="playerPosition(i, snapshotPlayers.length)"
        >
          <div class="reveal-token-wrap">
            <Token :role="isRevealed(i) ? player.role : {}" />
            <div
              class="alignment-overlay"
              :class="effectiveAlignment(player)"
              v-if="isRevealed(i) && effectiveAlignment(player)"
            ></div>
            <div class="token-shroud" v-if="player.isDead"></div>
            <div
              class="points-badge"
              v-if="pointsVisible && hasPoints(i)"
              :style="{ animationDelay: pointsDelay(i) }"
            >
              +{{ snapshotPoints[i] }}
            </div>
            <div
              class="true-token-wrap"
              v-if="player.trueRole && isTrueRevealed(i)"
            >
              <Token :role="player.trueRole" />
              <div
                class="true-alignment-overlay"
                :class="trueAlignment(player)"
                v-if="trueAlignment(player)"
              ></div>
            </div>
          </div>
          <div class="reveal-name" v-if="isRevealed(i)">
            {{ player.name }}
          </div>
          <div class="reveal-name-blank" v-else>&nbsp;</div>
        </div>
      </div>

      <div
        v-if="extrasVisible && snapshotExtras.fabled.length"
        class="fabled-section"
      >
        <h3>Fabled &amp; Loric</h3>
        <ul>
          <li
            v-for="(f, i) in snapshotExtras.fabled"
            :key="i"
            :style="{ animationDelay: i * 350 + 'ms' }"
          >
            <Token :role="f" />
          </li>
        </ul>
      </div>

      <div
        v-if="extrasVisible && snapshotExtras.bluffs.length"
        class="bluffs-section"
      >
        <h3>Demon Bluffs</h3>
        <ul>
          <li
            v-for="(bluff, i) in snapshotExtras.bluffs"
            :key="i"
            :style="{ animationDelay: i * 350 + 'ms' }"
          >
            <Token :role="bluff" />
          </li>
        </ul>
      </div>
    </div>
  </transition>
</template>

<script>
import { mapState } from "vuex";
import Token from "./Token.vue";
import { effectiveAlignment } from "@/utils/alignment";

const PHASE1_DELAY_MS = 1000;
const MAIN_REVEAL_INTERVAL_MS = 650;
const TRUE_REVEAL_INTERVAL_MS = 450;
const FINAL_PAIR_PAUSE_MS = 1000;
const FINAL_PAIR_SHAKE_MS = 1000;
const EXTRAS_DELAY_MS = 1200;
// Fabled/Bluff tokens pop in 350ms apart over 600ms (see bluff-appear)
const EXTRAS_STAGGER_MS = 350;
const EXTRAS_ANIMATION_MS = 600;
const POINTS_DELAY_MS = 1200;
const POINTS_STAGGER_MS = 250;

export default {
  components: { Token },
  computed: {
    ...mapState(["session"]),
    snapshotPlayers() {
      return this.session.victoryRevealSnapshot
        ? this.session.victoryRevealSnapshot.players
        : [];
    },
    snapshotWinners() {
      return this.session.victoryRevealSnapshot
        ? this.session.victoryRevealSnapshot.winners
        : [];
    },
    winningTeam() {
      return this.session.victoryRevealSnapshot
        ? this.session.victoryRevealSnapshot.winningTeam
        : null;
    },
    isVisible() {
      return this.session.victoryRevealActive && !this.dismissed;
    },
    allRevealed() {
      const excluded = (this.finalPairIndices || []).length;
      const target = this.snapshotPlayers.length - excluded;
      return this.revealedIndices.length >= target && target > 0;
    },
    snapshotPoints() {
      const snap = this.session.victoryRevealSnapshot;
      return snap && snap.points ? snap.points : [];
    },
    snapshotExtras() {
      const snap = this.session.victoryRevealSnapshot;
      return {
        bluffs: snap ? snap.bluffs || [] : [],
        fabled: snap ? snap.fabled || [] : []
      };
    }
  },
  data() {
    return {
      dismissed: true,
      revealedIndices: [],
      revealOrder: [],
      revealIdx: 0,
      revealedTrueIndices: [],
      trueRevealOrder: [],
      trueRevealIdx: 0,
      extrasVisible: false,
      pointsVisible: false,
      finalPairIndices: [],
      finalPairShaking: false,
      finalPairRevealed: false
    };
  },
  created() {
    this.phase1Timer = null;
    this.phase2Interval = null;
    this.trueRevealInterval = null;
    this.bluffsTimer = null;
    this.pointsTimer = null;
    this.finalShakeTimer = null;
    this.finalRevealTimer = null;
  },
  beforeDestroy() {
    clearTimeout(this.phase1Timer);
    clearInterval(this.phase2Interval);
    clearInterval(this.trueRevealInterval);
    clearTimeout(this.bluffsTimer);
    clearTimeout(this.pointsTimer);
    clearTimeout(this.finalShakeTimer);
    clearTimeout(this.finalRevealTimer);
  },
  watch: {
    allRevealed(val) {
      if (!val) return;
      if (this.finalPairIndices.length) {
        this.triggerFinalPair();
      } else {
        this.startTrueReveal();
      }
    },
    "session.revealCount"(val) {
      if (val > 0) this.startReveal();
    }
  },
  methods: {
    isTrueRevealed(i) {
      return this.revealedTrueIndices.includes(i);
    },
    startTrueReveal() {
      const personaIndices = this.snapshotPlayers
        .map((p, i) => (p.trueRole ? i : -1))
        .filter(i => i !== -1)
        .sort(() => Math.random() - 0.5);
      if (!personaIndices.length) {
        this.scheduleExtras();
        return;
      }
      this.trueRevealOrder = personaIndices;
      this.trueRevealIdx = 0;
      this.trueRevealInterval = setInterval(() => {
        if (this.trueRevealIdx < this.trueRevealOrder.length) {
          this.revealedTrueIndices = [
            ...this.revealedTrueIndices,
            this.trueRevealOrder[this.trueRevealIdx]
          ];
          this.trueRevealIdx++;
        } else {
          clearInterval(this.trueRevealInterval);
          this.scheduleExtras();
        }
      }, TRUE_REVEAL_INTERVAL_MS);
    },
    scheduleExtras() {
      const { bluffs, fabled } = this.snapshotExtras;
      if (!bluffs.length && !fabled.length) {
        // nothing to show — points (One Night) follow the true-role reveal
        this.schedulePoints(0);
        return;
      }
      clearTimeout(this.bluffsTimer);
      this.bluffsTimer = setTimeout(() => {
        this.extrasVisible = true;
        const longest = Math.max(bluffs.length, fabled.length);
        this.schedulePoints(
          (longest - 1) * EXTRAS_STAGGER_MS + EXTRAS_ANIMATION_MS
        );
      }, EXTRAS_DELAY_MS);
    },
    /**
     * One Night: points pop in after every other reveal animation.
     * @param afterMs time until the previous pop-ins have finished
     */
    schedulePoints(afterMs) {
      if (!this.snapshotPoints.length) return;
      clearTimeout(this.pointsTimer);
      this.pointsTimer = setTimeout(() => {
        this.pointsVisible = true;
      }, afterMs + POINTS_DELAY_MS);
    },
    hasPoints(i) {
      const points = this.snapshotPoints[i];
      return points !== undefined && points !== null;
    },
    pointsDelay(i) {
      // stagger in seat order, skipping players without points
      const position = this.snapshotPoints
        .slice(0, i)
        .filter(p => p !== undefined && p !== null).length;
      return position * POINTS_STAGGER_MS + "ms";
    },
    triggerFinalPair() {
      if (!this.finalPairIndices.length) return;
      clearTimeout(this.finalShakeTimer);
      clearTimeout(this.finalRevealTimer);
      // Dramatic pause → shake → simultaneous reveal.
      // True reveal (persona tokens) and extras run AFTER the final pair pops.
      this.finalShakeTimer = setTimeout(() => {
        this.finalPairShaking = true;
        this.finalRevealTimer = setTimeout(() => {
          this.finalPairShaking = false;
          this.finalPairRevealed = true;
          this.startTrueReveal();
        }, FINAL_PAIR_SHAKE_MS);
      }, FINAL_PAIR_PAUSE_MS);
    },
    startReveal() {
      this.dismissed = false;
      clearTimeout(this.phase1Timer);
      clearInterval(this.phase2Interval);
      clearInterval(this.trueRevealInterval);
      clearTimeout(this.bluffsTimer);
      clearTimeout(this.pointsTimer);
      clearTimeout(this.finalShakeTimer);
      clearTimeout(this.finalRevealTimer);
      this.revealedIndices = [];
      this.revealIdx = 0;
      this.revealedTrueIndices = [];
      this.trueRevealOrder = [];
      this.trueRevealIdx = 0;
      this.extrasVisible = false;
      this.pointsVisible = false;
      const n = this.snapshotPlayers.length;
      // Read Final 3 state from snapshot
      const snap = this.session.victoryRevealSnapshot;
      const snapFinalPair = snap && snap.finalThree ? snap.finalPair || [] : [];
      this.finalPairIndices = snapFinalPair;
      this.finalPairShaking = false;
      this.finalPairRevealed = false;
      // Use the ST-generated order from the snapshot so all clients reveal
      // in the same sequence. Fall back to local generation if unavailable.
      // When Final 3 is active, revealOrder covers only the n-2 non-pair players.
      const snapshotOrder = snap && snap.revealOrder;
      const expectedLen = n - snapFinalPair.length;
      if (snapshotOrder && snapshotOrder.length === expectedLen) {
        this.revealOrder = [...snapshotOrder];
      } else {
        // Local fallback — generate order excluding final pair (alive-only tail reps,
        // matching the Rule 2 logic used by buildRevealOrder in VictoryModal).
        this.revealOrder = Array.from({ length: n }, (_, i) => i)
          .filter(i => !snapFinalPair.includes(i))
          .sort(() => Math.random() - 0.5);
        const featuredPos = alignment =>
          this.revealOrder.findIndex(
            i =>
              !this.snapshotPlayers[i].isDead &&
              this.effectiveAlignment(this.snapshotPlayers[i]) === alignment
          );
        const goodPos = featuredPos("good");
        const evilPos = featuredPos("evil");
        const candidates = [
          { key: "good", pos: goodPos },
          { key: "evil", pos: evilPos }
        ]
          .filter(p => p.pos !== -1)
          .sort((a, b) => b.pos - a.pos);
        const extracted = {};
        for (const { key, pos } of candidates) {
          extracted[key] = this.revealOrder.splice(pos, 1)[0];
        }
        const losingTeam = this.winningTeam === "evil" ? "good" : "evil";
        if (extracted[losingTeam] !== undefined) {
          this.revealOrder.push(extracted[losingTeam]);
        }
        if (extracted[this.winningTeam] !== undefined) {
          this.revealOrder.push(extracted[this.winningTeam]);
        }
      }

      // Phase 1 — blank pause
      this.phase1Timer = setTimeout(() => {
        // Phase 2 — reveal one token per interval in reveal order
        this.phase2Interval = setInterval(() => {
          if (this.revealIdx < this.revealOrder.length) {
            this.revealedIndices = [
              ...this.revealedIndices,
              this.revealOrder[this.revealIdx]
            ];
            this.revealIdx++;
          } else {
            clearInterval(this.phase2Interval);
          }
        }, MAIN_REVEAL_INTERVAL_MS);
      }, PHASE1_DELAY_MS);
    },
    dismiss() {
      this.dismissed = true;
      clearTimeout(this.phase1Timer);
      clearInterval(this.phase2Interval);
      clearInterval(this.trueRevealInterval);
      clearTimeout(this.bluffsTimer);
      clearTimeout(this.pointsTimer);
      clearTimeout(this.finalShakeTimer);
      clearTimeout(this.finalRevealTimer);
      // ST clears reveal from Vuex so new joiners don't inherit a stale reveal state
      if (!this.session.isSpectator) {
        this.$store.commit("session/clearVictoryReveal");
      }
    },
    isRevealed(i) {
      return (
        this.revealedIndices.includes(i) ||
        (this.finalPairRevealed && this.finalPairIndices.includes(i))
      );
    },
    isWinner(i) {
      return this.snapshotWinners.includes(i);
    },
    effectiveAlignment,
    trueAlignment(player) {
      if (!player.trueRole) return null;
      if (player.trueRole.alignment) return player.trueRole.alignment;
      if (["townsfolk", "outsider"].includes(player.trueRole.team))
        return "good";
      if (["minion", "demon"].includes(player.trueRole.team)) return "evil";
      return null;
    },
    particleStyle(i) {
      const angle = (i / 40) * 360;
      const delay = (i % 8) * 0.15;
      const size = 6 + (i % 5) * 4;
      const distance = 30 + (i % 4) * 15;
      return {
        "--angle": `${angle}deg`,
        "--delay": `${delay}s`,
        "--size": `${size}px`,
        "--distance": `${distance}vh`
      };
    },
    playerPosition(i, n) {
      if (n === 0) return {};
      const angle = ((2 * Math.PI) / n) * i - Math.PI / 2;
      // Radius scales with player count so all tokens stay on screen
      const radius = Math.min(46, Math.max(26.5, n * 3.2));
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      return {
        transform: `translate(calc(-50% + ${x}vh), calc(-70% + ${y}vh))`
      };
    }
  }
};
</script>

<style lang="scss">
@import "../vars.scss";

.grimoire-reveal-overlay {
  position: fixed;
  inset: 0;
  z-index: 520;
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow: hidden;
  pointer-events: all;

  &.good {
    background: radial-gradient(
      ellipse at center,
      rgba(20, 60, 140, 0.96) 0%,
      rgba(5, 10, 40, 0.99) 70%
    );
    .reveal-title {
      color: #7ec8ff;
      text-shadow: 0 0 30px rgba(80, 160, 255, 0.8);
    }
  }

  &.evil {
    background: radial-gradient(
      ellipse at center,
      rgba(100, 10, 10, 0.96) 0%,
      rgba(20, 0, 30, 0.99) 70%
    );
    .reveal-title {
      color: #ff6060;
      text-shadow: 0 0 30px rgba(255, 60, 60, 0.8);
    }
  }
}

.reveal-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
  padding: 18px 24px 0;
  width: 100%;
  flex-shrink: 0;
  position: relative;
  z-index: 3;
}

.reveal-title {
  font-family: "Papyrus", "Palatino Linotype", serif;
  font-size: clamp(28px, 5vw, 56px);
  font-weight: bold;
  pointer-events: none;
}

.reveal-phase {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.45);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  animation: phase-blink 1.2s ease-in-out infinite;
}

.reveal-particle-layer {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  opacity: 0.8;
  overflow: hidden;
}

.rp {
  position: absolute;
  top: 50%;
  left: 50%;
  width: var(--size);
  height: var(--size);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  animation: particle-burst 2.5s ease-out var(--delay) infinite;
}

.good .rp {
  background: radial-gradient(
    circle,
    #ffe87a 0%,
    #4da6ff 60%,
    transparent 100%
  );
}

.evil .rp {
  background: radial-gradient(
    circle,
    #ffcc44 0%,
    #e03030 60%,
    transparent 100%
  );
}

.reveal-town {
  position: relative;
  flex: 1;
  width: 100%;
  z-index: 2;
}

.reveal-close-btn {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 10;
  font-size: 1.1rem;
  width: auto;
  padding: 0 6px;
  margin: 0;
}

.reveal-player {
  position: absolute;
  top: 50%;
  left: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  width: 12vh;
  text-align: center;
}

.reveal-token-wrap {
  position: relative;
  width: 12vh;
  height: 12vh;
  overflow: visible;

  .token {
    height: 100%;
    cursor: default;
  }
}

.true-token-wrap {
  position: absolute;
  left: 10%;
  top: 30%;
  width: 65%;
  height: 65%;
  z-index: 7;
  opacity: 0;
  transform: translate(-50%, -50%) scale(0);
  // Delay accounts for the token-pop flip animation (300ms) plus a beat
  animation: true-token-appear 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;

  .token {
    height: 100%;
    cursor: default;
  }

  .true-alignment-overlay {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    pointer-events: none;
    mix-blend-mode: color;
    z-index: 1;

    &.good {
      background: rgba(40, 110, 255, 0.85);
    }
    &.evil {
      background: rgba(220, 40, 40, 0.85);
    }
  }
}

@keyframes true-token-appear {
  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}

.reveal-player.revealed .reveal-token-wrap {
  animation: token-pop 300ms cubic-bezier(0.2, 0.8, 0.3, 1.3) both;
}

.reveal-player.revealed.evil-reveal .reveal-token-wrap::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 3px solid rgba(255, 80, 80, 0.95);
  pointer-events: none;
  z-index: 10;
  animation: shockwave-ring 0.7s ease-out both;
}

.reveal-player.winner .reveal-token-wrap > .token {
  animation: winner-glow-pulse 2.5s ease-in-out infinite;
}

// Phase 1: unrevealed token appears as a dimmed bare token disc
.reveal-player:not(.revealed) .reveal-token-wrap .token {
  animation: silhouette-pulse 2s ease-in-out infinite;
}

.alignment-overlay {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  pointer-events: none;
  mix-blend-mode: color;
  z-index: 3;

  &.good {
    background: rgba(40, 110, 255, 0.85);
  }
  &.evil {
    background: rgba(220, 40, 40, 0.85);
  }
}

.token-shroud {
  position: absolute;
  top: -10%;
  left: 0;
  width: 100%;
  height: 40%;
  background: url("../assets/shroud.png") top center no-repeat;
  background-size: auto 100%;
  filter: drop-shadow(0 0 5px rgba(0, 0, 0, 0.9));
  pointer-events: none;
  z-index: 4;
}

.points-badge {
  position: absolute;
  right: -8%;
  bottom: -4%;
  z-index: 8;
  min-width: 4.2vh;
  padding: 0.3vh 0.8vh;
  border: 2px solid gold;
  border-radius: 2vh;
  background: rgba(0, 0, 0, 0.85);
  color: gold;
  font-size: 2vh;
  font-weight: bold;
  line-height: 1.2;
  text-align: center;
  box-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
  opacity: 0;
  animation: points-pop 400ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

@keyframes points-pop {
  from {
    opacity: 0;
    transform: scale(0);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.reveal-points-caption {
  color: gold;
  font-size: 0.9rem;
  letter-spacing: 0.05em;
  animation: name-appear 300ms ease both;
}

.reveal-name {
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.9);
  line-height: 1.2;
  word-break: break-word;
  max-width: 80px;
  animation: name-appear 300ms ease both;
}

.reveal-name-blank {
  font-size: 0.72rem;
  line-height: 1.2;
}

// Transitions
.reveal-fade-enter-active {
  transition: opacity 0.5s ease;
}
.reveal-fade-leave-active {
  transition: opacity 0.4s ease;
}
.reveal-fade-enter,
.reveal-fade-leave-to {
  opacity: 0;
}

@keyframes silhouette-pulse {
  0%,
  100% {
    opacity: 0.2;
  }
  50% {
    opacity: 0.35;
  }
}

@keyframes token-pop {
  from {
    opacity: 0;
    transform: scale(0.5);
    filter: blur(6px);
  }
  to {
    opacity: 1;
    transform: scale(1);
    filter: blur(0);
  }
}

@keyframes winner-glow-pulse {
  0%,
  100% {
    box-shadow: 0 0 12px 3px rgba(255, 215, 0, 0.4),
      0 0 28px rgba(255, 200, 0, 0.2);
  }
  50% {
    box-shadow: 0 0 24px 8px rgba(255, 215, 0, 0.8),
      0 0 60px rgba(255, 200, 0, 0.4);
  }
}

@keyframes name-appear {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes phase-blink {
  0%,
  100% {
    opacity: 0.45;
  }
  50% {
    opacity: 0.9;
  }
}

@keyframes particle-burst {
  0% {
    opacity: 1;
    transform: translate(-50%, -50%) rotate(var(--angle)) translateY(0);
  }
  80% {
    opacity: 0.6;
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) rotate(var(--angle))
      translateY(calc(-1 * var(--distance)));
  }
}

.fabled-section,
.bluffs-section {
  position: absolute;
  left: 10px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 10px;
  border: 3px solid black;
  filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.5));
  z-index: 5;
  animation: name-appear 300ms ease both;

  h3 {
    margin: 5px 1vh 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.8);
    font-weight: normal;
    letter-spacing: 0.05em;
  }

  ul {
    display: flex;
    align-items: center;
    justify-content: center;
    list-style: none;
    margin: 0;
    padding: 4px 6px 6px;
    li {
      width: 10vh;
      height: 10vh;
      margin: 0 0.5%;
      display: inline-block;
      opacity: 0;
      animation: bluff-appear 600ms ease-in-out both;

      .token {
        height: 100%;
        cursor: default;
      }
    }
  }
}

.fabled-section {
  top: 10px;
}

.bluffs-section {
  bottom: 10px;
}

@keyframes bluff-appear {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

// ── Final 3 animations ────────────────────────────────────────

.reveal-player.final-pair-shaking .reveal-token-wrap {
  animation: final-pair-shake 0.09s ease-in-out infinite !important;
}

@keyframes final-pair-shake {
  0%,
  100% {
    transform: translateX(0) rotate(0deg);
  }
  25% {
    transform: translateX(-5px) rotate(-2.5deg);
  }
  75% {
    transform: translateX(5px) rotate(2.5deg);
  }
}

// Shockwave ring expands outward on simultaneous reveal (Option D)
.reveal-player.final-pair-revealed .reveal-token-wrap::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  pointer-events: none;
  z-index: 10;
  animation: shockwave-ring 0.7s ease-out both;
}

.good .reveal-player.final-pair-revealed .reveal-token-wrap::before {
  border: 3px solid rgba(100, 180, 255, 0.95);
}

.evil .reveal-player.final-pair-revealed .reveal-token-wrap::before {
  border: 3px solid rgba(255, 80, 80, 0.95);
}

@keyframes shockwave-ring {
  from {
    transform: scale(1);
    opacity: 1;
  }
  to {
    transform: scale(2.8);
    opacity: 0;
  }
}

// Winner glow: one-shot burst that fades to the dim baseline, then the steady
// pulse takes over seamlessly. The burst ends at the same value that
// winner-glow-pulse starts at (0%/100%), so there is no seam on the handoff.
.reveal-player.final-pair-revealed.winner .reveal-token-wrap > .token {
  animation: winner-glow-burst 1s ease-out forwards,
    winner-glow-pulse 2.5s ease-in-out 1s infinite !important;
}

@keyframes winner-glow-burst {
  0% {
    box-shadow: 0 0 40px 18px rgba(255, 215, 0, 1),
      0 0 100px rgba(255, 200, 0, 0.7);
  }
  100% {
    box-shadow: 0 0 12px 3px rgba(255, 215, 0, 0.4),
      0 0 28px rgba(255, 200, 0, 0.2);
  }
}
</style>
