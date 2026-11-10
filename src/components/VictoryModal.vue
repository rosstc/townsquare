<template>
  <div v-if="team" class="victory-modal-backdrop" @click.self="close">
    <div class="victory-modal" :class="team">
      <h2 class="modal-title">
        {{ team === "good" ? "Good Wins" : "Evil Wins" }}
      </h2>
      <p class="modal-sub">Select the winners — click tokens to toggle</p>
      <p class="winner-count">
        {{ selectedCount }} winner{{ selectedCount !== 1 ? "s" : "" }} selected
      </p>
      <p class="scoring-source" v-if="session.isOneNight">
        {{ scoringSourceText }}
        <span
          class="clear-votes"
          v-if="session.oneNightVotes"
          @click="clearOneNightVotes"
          >Clear votes</span
        >
      </p>

      <div class="player-grid">
        <div
          v-for="(player, i) in players"
          :key="i"
          class="player-card"
          :class="{
            selected: winners[i],
            dead: player.isDead,
            'no-role': !player.role || !player.role.id
          }"
          :style="playerPosition(i, players.length)"
          @click="toggleWinner(i)"
        >
          <div class="card-token-wrap">
            <Token :role="player.role || {}" />
            <div
              class="alignment-overlay"
              :class="player.alignment"
              v-if="player.alignment"
            ></div>
            <div
              class="alignment-indicator"
              :class="player.alignment || 'unset'"
              @click.stop="cycleAlignment(i)"
            ></div>
            <div class="card-shroud" v-if="player.isDead"></div>
            <div class="true-token-wrap" v-if="playerTrueRoles[i]">
              <Token :role="playerTrueRoles[i]" />
              <div
                class="true-alignment-overlay"
                :class="playerTrueRoles[i].alignment"
                v-if="playerTrueRoles[i].alignment"
              ></div>
            </div>
          </div>
          <div class="card-name">{{ player.name || "(empty)" }}</div>
          <div class="card-team" v-if="player.role && player.role.team">
            {{ player.role.team }}
          </div>
          <div
            class="card-points"
            v-if="points[i] !== undefined && points[i] !== null"
          >
            +{{ points[i] }}
          </div>
        </div>
      </div>

      <div class="modal-actions">
        <span class="action-btn close-btn" @click="close">Close</span>
        <span class="action-btn declare-btn" @click="declareVictory">
          Declare Victory
        </span>
        <span
          class="action-btn reveal-btn"
          :class="{ disabled: selectedCount === 0 }"
          @click="revealGrimoire"
        >
          Reveal Grimoire
        </span>
      </div>
    </div>
  </div>
</template>

<script>
import { mapState } from "vuex";
import Token from "./Token.vue";
import { effectiveAlignment } from "@/utils/alignment";
import {
  oneNightPoints,
  oneNightRevealOrder,
  leaderboardRevealRows,
  leaderboardKey
} from "@/utils/oneNight";

export default {
  components: { Token },
  computed: {
    ...mapState(["session"]),
    ...mapState("players", ["players"]),
    team() {
      return this.session.victoryModalTeam;
    },
    selectedCount() {
      return this.winners.filter(Boolean).length;
    },
    playerTrueRoles() {
      return this.players.map(p => this.trueRoleFor(p));
    },
    // One Night: points per player, recalculated as the ST adjusts alignments
    points() {
      if (!this.session.isOneNight || !this.team) return [];
      return oneNightPoints(
        this.players,
        this.team,
        this.session.oneNightVotes
      );
    },
    scoringSourceText() {
      const votes = this.session.oneNightVotes;
      if (!votes) return "No vote — non-vote scoring only";
      const n = Object.keys(votes).length;
      return `Scoring with the last Secret Point Vote (${n} vote${
        n !== 1 ? "s" : ""
      })`;
    }
  },
  data() {
    return {
      winners: []
    };
  },
  watch: {
    team(val) {
      if (val) this.initWinners();
    }
  },
  methods: {
    initWinners() {
      const team = this.team;
      this.winners = this.players.map(player => {
        if (!player.role || !player.role.team) return false;
        // Explicit alignment set by ST overrides team default
        if (player.alignment === "good") return team === "good";
        if (player.alignment === "evil") return team === "evil";
        // Fall back to role team membership
        if (team === "good") {
          return (
            player.role.team === "townsfolk" || player.role.team === "outsider"
          );
        }
        if (team === "evil") {
          return player.role.team === "demon" || player.role.team === "minion";
        }
        return false;
      });
    },
    /**
     * This game's points for the leaderboard, keyed by leaderboardKey.
     * Unseated players score under their seat name; nameless seats and
     * players without an alignment don't score.
     */
    leaderboardScores() {
      const scores = {};
      this.players.forEach((player, i) => {
        const points = this.points[i];
        const key = leaderboardKey(player);
        if (!key || points === null || points === undefined) return;
        scores[key] = { name: player.name, points };
      });
      return scores;
    },
    clearOneNightVotes() {
      this.$store.commit("session/setOneNightVotes", null);
    },
    toggleWinner(i) {
      this.$set(this.winners, i, !this.winners[i]);
    },
    close() {
      this.$store.commit("session/setVictoryModalTeam", null);
    },
    declareVictory() {
      this.$store.commit("session/clearVictoryReveal");
      this.$store.commit("session/declareVictory", this.team);
      this.$store.commit("session/setVictoryModalTeam", null);
    },
    cycleAlignment(i) {
      const player = this.players[i];
      const current = player.alignment;
      const roleTeam = player.role && player.role.team;
      let next;
      if (roleTeam === "traveler") {
        // Full three-step cycle for travellers
        next = current === null ? "good" : current === "good" ? "evil" : null;
      } else {
        // Two-step: toggle to opposite of base team, or back to null
        const baseEvil = roleTeam === "minion" || roleTeam === "demon";
        const opposite = baseEvil ? "good" : "evil";
        next = current === null ? opposite : null;
      }
      this.$store.commit("players/update", {
        player,
        property: "alignment",
        value: next
      });
      // Auto-update winner selection based on the new alignment
      let isWinner;
      if (!roleTeam) {
        isWinner = false;
      } else if (next === "good") {
        isWinner = this.team === "good";
      } else if (next === "evil") {
        isWinner = this.team === "evil";
      } else if (this.team === "good") {
        isWinner = roleTeam === "townsfolk" || roleTeam === "outsider";
      } else if (this.team === "evil") {
        isWinner = roleTeam === "demon" || roleTeam === "minion";
      } else {
        isWinner = false;
      }
      this.$set(this.winners, i, isWinner);
    },
    _serializeRole(r) {
      return {
        id: r.id,
        name: r.name,
        team: r.team,
        image: r.image,
        imageAlt: r.imageAlt
      };
    },
    trueRoleFor(player) {
      if (!player.reminders || !player.reminders.length) return null;
      let roleData = null;
      const match = player.reminders.find(r => {
        const rd =
          this.$store.state.roles.get(r.role) ||
          this.$store.getters.rolesJSONbyId.get(r.role);
        if (
          rd &&
          ((Array.isArray(rd.remindersPersonaGlobal) &&
            rd.remindersPersonaGlobal.includes(r.name)) ||
            (Array.isArray(rd.remindersPersona) &&
              rd.remindersPersona.includes(r.name)))
        ) {
          roleData = rd;
          return true;
        }
        return false;
      });
      if (!match || !roleData) return null;
      let alignment = null;
      if (["townsfolk", "outsider"].includes(roleData.team)) alignment = "good";
      else if (["minion", "demon"].includes(roleData.team)) alignment = "evil";
      if (match.name.startsWith("GOOD ")) alignment = "good";
      else if (match.name.startsWith("EVIL ")) alignment = "evil";
      const serialized = this._serializeRole(roleData);
      // Evil Twin: the "Twin" persona is placed on the good player — show "Twin" and
      // reflect that player's own alignment rather than the Evil Twin's minion team.
      if (roleData.id === "eviltwin") {
        serialized.name = match.name;
        alignment = this.effectiveAlignment(player);
      }
      return { ...serialized, alignment };
    },
    // ─────────────────────────────────────────────────────────────────────────
    // buildRevealOrder
    // Determines the reveal sequence for a grimoire reveal.
    // Returns { revealOrder, finalThree, finalPair }.
    //   revealOrder  — ordered array of player indices for the primary reveal
    //   finalThree   — true when the special pair-reveal animation should fire
    //   finalPair    — two player indices held back for the simultaneous reveal
    // ─────────────────────────────────────────────────────────────────────────
    buildRevealOrder(snapshotPlayers, team) {
      const n = snapshotPlayers.length;
      const order = Array.from({ length: n }, (_, i) => i).sort(
        () => Math.random() - 0.5
      );
      const livingCount = snapshotPlayers.filter(p => !p.isDead).length;

      let finalThree = false;
      let finalPair = [];
      let tailOrdered = false;
      // tailLength tracks how many elements at the END of order are intentionally
      // ordered by a rule and must not be moved by the dead-before-alive sort.
      let tailLength = 0;

      if (team === "good") {
        // ── Rule 1a · Good Win FinalPair ──────────────────────────────────
        // Any good win where ≥1 alive evil AND ≥1 alive good → finalPair.
        const aliveEvilPos = order.findIndex(
          i =>
            !snapshotPlayers[i].isDead &&
            this.effectiveAlignment(snapshotPlayers[i]) === "evil"
        );
        const aliveGoodPos = order.findIndex(
          i =>
            !snapshotPlayers[i].isDead &&
            this.effectiveAlignment(snapshotPlayers[i]) === "good"
        );
        if (aliveEvilPos !== -1 && aliveGoodPos !== -1) {
          finalThree = true;
          tailOrdered = true;
          const hi = Math.max(aliveEvilPos, aliveGoodPos);
          const lo = Math.min(aliveEvilPos, aliveGoodPos);
          finalPair = [order.splice(hi, 1)[0], order.splice(lo, 1)[0]];
        } else if (livingCount === 2) {
          // ── Rule 1a-B · Good Win Sequential (2 alive, both good) ────────
          // Activate only when a dead evil-aligned demon exists.
          const deadEvilDemonPos = order.findIndex(
            i =>
              snapshotPlayers[i].isDead &&
              snapshotPlayers[i].role.team === "demon" &&
              this.effectiveAlignment(snapshotPlayers[i]) === "evil"
          );
          if (deadEvilDemonPos !== -1) {
            const deadDemon = order.splice(deadEvilDemonPos, 1)[0];
            const aliveGoods = [];
            for (let i = order.length - 1; i >= 0; i--) {
              if (
                !snapshotPlayers[order[i]].isDead &&
                this.effectiveAlignment(snapshotPlayers[order[i]]) === "good"
              ) {
                aliveGoods.unshift(order.splice(i, 1)[0]);
              }
            }
            order.push(deadDemon);
            order.push(...aliveGoods);
            tailOrdered = true;
            tailLength = 1 + aliveGoods.length;
          }
          // else: no dead evil demon → fall through to Rule 2
        }
        // else: no alive evil and livingCount ≠ 2 → fall through to Rule 2
      } else if (team === "evil") {
        if (livingCount === 2) {
          // ── Rule 1b · Evil Win, 2 Alive ─────────────────────────────────
          // Different alignments → finalPair for dramatic simultaneous reveal.
          const aliveEvilPos = order.findIndex(
            i =>
              !snapshotPlayers[i].isDead &&
              this.effectiveAlignment(snapshotPlayers[i]) === "evil"
          );
          const aliveGoodPos = order.findIndex(
            i =>
              !snapshotPlayers[i].isDead &&
              this.effectiveAlignment(snapshotPlayers[i]) === "good"
          );
          if (aliveEvilPos !== -1 && aliveGoodPos !== -1) {
            finalThree = true;
            tailOrdered = true;
            const hi = Math.max(aliveEvilPos, aliveGoodPos);
            const lo = Math.min(aliveEvilPos, aliveGoodPos);
            finalPair = [order.splice(hi, 1)[0], order.splice(lo, 1)[0]];
          }
          // else: same alignment (both evil or edge case) → fall through to Rule 2
        } else if (livingCount > 2) {
          // ── Overwhelming Evil Victory ─────────────────────────────────
          // When every alive player is evil-aligned, reveal them all
          // simultaneously as a group rather than selecting a pair.
          const hasAliveNonEvil = snapshotPlayers.some(
            p => !p.isDead && this.effectiveAlignment(p) !== "evil"
          );
          if (!hasAliveNonEvil) {
            // All alive are evil — collect every alive player into the reveal set.
            for (let i = order.length - 1; i >= 0; i--) {
              if (!snapshotPlayers[order[i]].isDead) {
                finalPair.unshift(order.splice(i, 1)[0]);
              }
            }
            finalThree = true;
            tailOrdered = true;
          } else {
            // At least one alive non-evil player — apply standard unusual-victory rules.
            const aliveDemonPos = order.findIndex(
              i =>
                !snapshotPlayers[i].isDead &&
                snapshotPlayers[i].role.team === "demon" &&
                this.effectiveAlignment(snapshotPlayers[i]) === "evil"
            );
            if (aliveDemonPos !== -1) {
              // ── Rule 1c · Evil Win, >2 Alive, Alive Evil Demon ──────────
              const aliveGoodPos = order.findIndex(
                i =>
                  !snapshotPlayers[i].isDead &&
                  this.effectiveAlignment(snapshotPlayers[i]) === "good"
              );
              if (aliveGoodPos !== -1) {
                // Pair the demon with a random alive good player.
                finalThree = true;
                tailOrdered = true;
                const hi = Math.max(aliveDemonPos, aliveGoodPos);
                const lo = Math.min(aliveDemonPos, aliveGoodPos);
                finalPair = [order.splice(hi, 1)[0], order.splice(lo, 1)[0]];
              } else {
                // No alive good (alive non-evil must be travelers) — demon last.
                const demon = order.splice(aliveDemonPos, 1)[0];
                order.push(demon);
                tailOrdered = true;
                tailLength = 1;
              }
            } else {
              // ── Rule 1d · Evil Win, >2 Alive, Dead Demon ──────────────
              // Prefer alive evil + alive good; fall back to two alive evil.
              const aliveEvilPos = order.findIndex(
                i =>
                  !snapshotPlayers[i].isDead &&
                  this.effectiveAlignment(snapshotPlayers[i]) === "evil"
              );
              if (aliveEvilPos !== -1) {
                const aliveGoodPos = order.findIndex(
                  i =>
                    !snapshotPlayers[i].isDead &&
                    this.effectiveAlignment(snapshotPlayers[i]) === "good"
                );
                let secondPos = aliveGoodPos;
                if (secondPos === -1) {
                  secondPos = order.findIndex(
                    (i, pos) =>
                      pos !== aliveEvilPos &&
                      !snapshotPlayers[i].isDead &&
                      this.effectiveAlignment(snapshotPlayers[i]) === "evil"
                  );
                }
                if (secondPos !== -1) {
                  finalThree = true;
                  tailOrdered = true;
                  const hi = Math.max(aliveEvilPos, secondPos);
                  const lo = Math.min(aliveEvilPos, secondPos);
                  finalPair = [order.splice(hi, 1)[0], order.splice(lo, 1)[0]];
                }
                // else: only 1 alive evil, no alive good → fall through to Rule 2
              }
              // else: no alive evil → fall through to Rule 2
            }
          }
        }
        // else: livingCount ≤ 1 → fall through to Rule 2
      }

      if (!tailOrdered) {
        // ── Rule 2 · Standard tail ────────────────────────────────────────
        // Losing-team representative second-to-last; winning-team last.
        // Only alive players qualify for the tail — dead players stay in the
        // body so the dead-before-alive sort places them correctly.
        const featuredPos = alignment =>
          order.findIndex(
            i =>
              !snapshotPlayers[i].isDead &&
              this.effectiveAlignment(snapshotPlayers[i]) === alignment
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
          extracted[key] = order.splice(pos, 1)[0];
        }
        const losingTeam = team === "evil" ? "good" : "evil";
        if (extracted[losingTeam] !== undefined) {
          order.push(extracted[losingTeam]);
          tailLength++;
        }
        if (extracted[team] !== undefined) {
          order.push(extracted[team]);
          tailLength++;
        }
      }

      // Dead players revealed before alive players within the body (non-tail portion).
      // The tail is intentionally ordered by the rule that set it, so it is excluded.
      const bodyEnd = order.length - tailLength;
      if (bodyEnd > 1) {
        const body = order.slice(0, bodyEnd);
        body.sort(
          (a, b) =>
            (snapshotPlayers[a].isDead ? 0 : 1) -
            (snapshotPlayers[b].isDead ? 0 : 1)
        );
        order.splice(0, bodyEnd, ...body);
      }

      return { revealOrder: order, finalThree, finalPair };
    },
    revealGrimoire() {
      if (this.selectedCount === 0) return;
      const team = this.team;
      const snapshotPlayers = this.players.map((player, i) => ({
        name: player.name,
        role:
          player.role && player.role.id ? this._serializeRole(player.role) : {},
        alignment: player.alignment,
        isDead: player.isDead,
        trueRole: this.playerTrueRoles[i]
      }));

      // One Night: the Demon and everyone executed share the final reveal
      const oneNightOrder =
        this.session && this.session.isOneNight
          ? oneNightRevealOrder(snapshotPlayers)
          : null;
      const { revealOrder, finalThree, finalPair } =
        oneNightOrder || this.buildRevealOrder(snapshotPlayers, team);

      const snapshot = {
        players: snapshotPlayers,
        winners: this.winners.reduce((acc, isWinner, i) => {
          if (isWinner) acc.push(i);
          return acc;
        }, []),
        winningTeam: team,
        revealOrder,
        bluffs: this.$store.state.players.bluffs
          .filter(r => r && r.id)
          .map(r => this._serializeRole(r)),
        fabled: this.$store.state.players.fabled
          .filter(r => r && r.id)
          .map(r => this._serializeRole(r)),
        finalThree,
        finalPair,
        // One Night: points pop in at the end of the reveal
        ...(this.points && this.points.length ? { points: this.points } : {})
      };
      // One Night: bank this game's points on the session leaderboard
      if (this.session && this.session.isOneNight && this.points.length) {
        const scores = this.leaderboardScores();
        // nobody seated (e.g. an offline test): nothing to record
        if (Object.keys(scores).length) {
          this.$store.commit("leaderboard/bankGame", {
            winningTeam: team,
            scores,
            time: Date.now()
          });
          // the reveal animates from the old standings to the new ones
          const { games, currentGameId } = this.$store.state.leaderboard;
          snapshot.leaderboard = leaderboardRevealRows(games, currentGameId);
        }
      }
      this.$store.commit("session/setVictoryReveal", snapshot);
      this.close();
    },
    playerPosition(i, n) {
      if (n === 0) return {};
      const angle = ((2 * Math.PI) / n) * i - Math.PI / 2;
      // Tighter radius than the full-screen reveal so tokens fit inside the modal
      const radius = Math.min(37, Math.max(21, n * 2.5));
      // Never wider or taller than the token area (cqw/cqh: its width and
      // height), leaving room for a card (~104px wide, ~150px tall), so the
      // buttons stay on screen in shorter windows. A squat area gives an oval.
      const rx = `min(${radius}vh, max(calc(50cqw - 56px), 60px))`;
      const ry = `min(${radius}vh, max(calc(50cqh - 80px), 40px))`;
      const round = value => Math.round(value * 10000) / 10000;
      const x = round(Math.cos(angle));
      const y = round(Math.sin(angle));
      return {
        transform: `translate(calc(-50% + ${x} * ${rx}), calc(-50% + ${y} * ${ry}))`
      };
    },
    effectiveAlignment
  }
};
</script>

<style scoped lang="scss">
@import "../vars.scss";

.victory-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 550;
  background: rgba(0, 0, 0, 0.88);
  display: flex;
  align-items: center;
  justify-content: center;
}

.victory-modal {
  background: rgba(10, 10, 20, 0.97);
  border-radius: 16px;
  padding: 28px 32px 24px;
  width: min(92vw, 1132px);
  // a fixed height lets the token area take whatever is left after the
  // title and buttons, so the buttons are never pushed off screen
  height: min(calc(100vh - 32px), 960px);
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: 0 0 60px rgba(0, 0, 0, 0.9);

  &.good {
    border: 2px solid rgba(77, 166, 255, 0.5);
    box-shadow: 0 0 60px rgba(0, 0, 0, 0.9), 0 0 30px rgba(77, 166, 255, 0.15);
    .modal-title {
      color: #7ec8ff;
    }
    .reveal-btn {
      color: #4da6ff;
      border-color: #4da6ff;
      &:hover:not(.disabled) {
        background: rgba(77, 166, 255, 0.15);
      }
    }
  }

  &.evil {
    border: 2px solid rgba(224, 48, 48, 0.5);
    box-shadow: 0 0 60px rgba(0, 0, 0, 0.9), 0 0 30px rgba(224, 48, 48, 0.15);
    .modal-title {
      color: #ff6060;
    }
    .reveal-btn {
      color: #e03030;
      border-color: #e03030;
      &:hover:not(.disabled) {
        background: rgba(224, 48, 48, 0.15);
      }
    }
  }
}

.modal-title {
  font-family: "Papyrus", "Palatino Linotype", serif;
  font-size: 2rem;
  text-align: center;
  margin: 0;
}

.modal-sub {
  text-align: center;
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.85rem;
  margin: 0;
}

.winner-count {
  text-align: center;
  color: rgba(255, 215, 0, 0.9);
  font-size: 0.9rem;
  font-weight: bold;
  margin: 0;
}

.player-grid {
  position: relative;
  flex: 1 1 0;
  min-height: 0;
  width: 100%;
  // tokens size their circle to this area (cqw / cqh in playerPosition)
  container-type: size;
}

.player-card {
  position: absolute;
  top: 50%;
  left: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  width: 104px;
  text-align: center;
  cursor: pointer;

  &.selected {
    .card-token-wrap {
      border-radius: 50%;
      animation: winner-glow-ring 2.5s ease-in-out infinite;
    }
    .card-name {
      color: gold;
      font-weight: bold;
    }
  }

  &.dead .card-token-wrap {
    opacity: 0.6;
  }
}

@keyframes winner-glow-ring {
  0%,
  100% {
    box-shadow: 0 0 0 2px rgba(255, 215, 0, 0.8),
      0 0 14px 4px rgba(255, 215, 0, 0.4);
  }
  50% {
    box-shadow: 0 0 0 3px gold, 0 0 26px 10px rgba(255, 215, 0, 0.7);
  }
}

.card-token-wrap {
  position: relative;
  width: 89px;
  height: 89px;
  overflow: visible;

  >>> .token {
    height: 100%;
    cursor: default;
  }
}

.true-token-wrap {
  position: absolute;
  left: -10%;
  top: 45%;
  width: 70%;
  height: 70%;
  z-index: 7;
  opacity: 0;
  transform: translate(-50%, -50%) scale(0);
  animation: true-token-appear 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;

  >>> .token {
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

.alignment-indicator {
  position: absolute;
  width: 30%;
  height: 30%;
  border-radius: 50%;
  right: -8%;
  top: 10%;
  border: 2px solid rgba(255, 255, 255, 0.4);
  filter: drop-shadow(0 0 4px rgba(0, 0, 0, 0.6));
  cursor: pointer;
  z-index: 5;
  transition: transform 150ms ease, filter 150ms ease;

  &:hover {
    transform: scale(1.2);
    filter: drop-shadow(0 0 6px rgba(255, 255, 255, 0.5));
  }

  &.good {
    background: linear-gradient(180deg, #3a7aff 0%, #4da6ff 100%);
    border-color: black;
  }
  &.evil {
    background: linear-gradient(180deg, #a00 0%, #e03030 100%);
    border-color: black;
  }
  &.unset {
    background: transparent;
  }
}

.card-shroud {
  position: absolute;
  top: -14%;
  left: 0;
  width: 100%;
  height: 58%;
  background: url("../assets/shroud.png") top center no-repeat;
  background-size: auto 100%;
  filter: drop-shadow(0 0 4px rgba(0, 0, 0, 0.9));
  pointer-events: none;
  z-index: 4;
}

.card-name {
  font-size: 0.7rem;
  text-align: center;
  color: rgba(255, 255, 255, 0.9);
  word-break: break-word;
  line-height: 1.2;
  max-width: 80px;
}

.card-team {
  font-size: 0.6rem;
  color: rgba(255, 255, 255, 0.4);
  text-transform: capitalize;
}

.card-points {
  font-size: 0.8rem;
  font-weight: bold;
  color: gold;
}

.scoring-source {
  text-align: center;
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.8rem;
  margin: 0;

  .clear-votes {
    margin-left: 8px;
    cursor: pointer;
    text-decoration: underline;
    color: rgba(255, 255, 255, 0.85);
    &:hover {
      color: white;
    }
  }
}

.modal-actions {
  flex-shrink: 0;
  display: flex;
  gap: 12px;
  justify-content: center;
  padding-top: 4px;
  flex-wrap: wrap;
}

.action-btn {
  cursor: pointer;
  padding: 6px 20px;
  border-radius: 20px;
  border: 2px solid;
  font-size: 0.9rem;
  font-weight: bold;
  transition: background 200ms, opacity 200ms;
  user-select: none;
}

.close-btn {
  color: rgba(255, 255, 255, 0.6);
  border-color: rgba(255, 255, 255, 0.3);
  &:hover {
    background: rgba(255, 255, 255, 0.08);
  }
}

.declare-btn {
  color: rgba(255, 255, 255, 0.85);
  border-color: rgba(255, 255, 255, 0.5);
  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }
}

.reveal-btn {
  &.disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
}
</style>
