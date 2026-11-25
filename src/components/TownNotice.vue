<template>
  <transition name="notice-fade">
    <div class="town-notice" v-if="text">{{ text }}</div>
  </transition>
</template>

<script>
import { mapState } from "vuex";

const NOTICE_MS = 4000;

/**
 * A short message in the centre of the town, e.g. after a Rerack.
 * Shown on this screen only, for a few seconds.
 */
export default {
  computed: {
    ...mapState(["session"])
  },
  data() {
    return {
      text: ""
    };
  },
  created() {
    this.hideTimer = null;
  },
  beforeDestroy() {
    clearTimeout(this.hideTimer);
  },
  watch: {
    "session.notice"(notice) {
      if (!notice) return;
      this.show(notice.text);
    }
  },
  methods: {
    show(text) {
      clearTimeout(this.hideTimer);
      this.text = text;
      this.hideTimer = setTimeout(() => {
        this.text = "";
      }, NOTICE_MS);
    }
  }
};
</script>

<style lang="scss" scoped>
.town-notice {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 60;
  max-width: calc(100% - 40px);
  padding: 10px 24px;
  border: 2px solid rgba(255, 215, 0, 0.7);
  border-radius: 20px;
  background: rgba(0, 0, 0, 0.85);
  color: white;
  font-size: 120%;
  font-weight: bold;
  text-align: center;
  text-shadow: 0 1px 2px black;
  pointer-events: none;
}

.notice-fade-enter-active,
.notice-fade-leave-active {
  transition: opacity 400ms ease;
}
.notice-fade-enter,
.notice-fade-leave-to {
  opacity: 0;
}
</style>
