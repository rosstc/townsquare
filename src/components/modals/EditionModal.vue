<template>
  <Modal class="editions" v-if="modals.edition" @close="toggleModal('edition')">
    <div v-if="!isCustom">
      <h3>Select an edition:</h3>
      <ul class="editions">
        <li
          v-for="edition in editions"
          class="edition"
          :class="['edition-' + edition.id]"
          :style="{
            backgroundImage: `url(${require('../../assets/editions/' +
              edition.id +
              '.png')})`
          }"
          :key="edition.id"
          @click="setEdition(edition)"
        >
          {{ edition.name }}
        </li>
        <li
          class="edition edition-custom"
          @click="isCustom = true"
          :style="{
            backgroundImage: `url(${require('../../assets/editions/custom.png')})`
          }"
        >
          Custom Script / Characters
        </li>
      </ul>
    </div>
    <div class="custom" v-else>
      <h3>Load custom script / characters</h3>
      To play with a custom script, you need to select the characters you want
      to play with in the official
      <a href="https://script.bloodontheclocktower.com/" target="_blank"
        >Script Tool</a
      >
      and then upload the generated "custom-list.json" either directly here or
      provide a URL to such a hosted JSON file.<br />
      <br />
      To play with custom characters, please read
      <a
        href="https://github.com/bra1n/townsquare#custom-characters"
        target="_blank"
        >the documentation</a
      >
      on how to write a custom character definition file.
      <b>Only load custom JSON files from sources that you trust!</b>
      <div class="script-columns">
        <div class="script-column">
          <h3>Some popular custom scripts:</h3>
          <ul class="scripts">
            <li
              v-for="(script, index) in scripts"
              :key="index"
              @click="handleURL(script[1])"
            >
              {{ script[0] }}
            </li>
          </ul>
        </div>
        <div class="script-column">
          <h3>One Night Ultimate scripts:</h3>
          <ul class="scripts">
            <li
              v-for="(script, index) in oneNightScripts"
              :key="index"
              @click="handleURL(script[1])"
            >
              {{ script[0] }}
            </li>
          </ul>
        </div>
      </div>
      <input
        type="file"
        ref="upload"
        accept="application/json"
        @change="handleUpload"
      />
      <div class="button-group">
        <div class="button" @click="openUpload">
          <font-awesome-icon icon="file-upload" /> Upload JSON
        </div>
        <div class="button" @click="promptURL">
          <font-awesome-icon icon="link" /> Enter URL
        </div>
        <div class="button" @click="readFromClipboard">
          <font-awesome-icon icon="clipboard" /> Use JSON from Clipboard
        </div>
        <div class="button" @click="isCustom = false">
          <font-awesome-icon icon="undo" /> Back
        </div>
      </div>
    </div>
  </Modal>
</template>

<script>
import editionJSON from "../../editions";
import { mapMutations, mapState } from "vuex";
import Modal from "./Modal";

export default {
  components: {
    Modal
  },
  data: function() {
    return {
      editions: editionJSON,
      isCustom: false,
      scripts: [
        [
          "Trouble with Violets",
          "https://gist.githubusercontent.com/LukeC82/6b3591278b5f97b4a0d31822c7fc8b53/raw/1edabb8171e49fdf69148f082e864d13ae6a1bf0/trouble_with_violets.json"
        ],
        [
          "House of Madness",
          "https://gist.githubusercontent.com/LukeC82/72a23aa50dcb035ad251b4c8e4dd3ad4/raw/d48c2c65b03455f1872cc221fe66406926f4e16f/House_of_Madness_v1.json"
        ],
        [
          "Lunar Eclipse v1.6",
          "https://gist.githubusercontent.com/LukeC82/bbd4324a334e38bf2a78dfd5c36bedc4/raw/89c8189a883727c91ac1d644ac9944cb02b382b8/Lunar_Eclipse_v1.6.json"
        ],
        [
          "Brainworms v2.0",
          "https://gist.githubusercontent.com/LukeC82/24a9b4af13f0e8b82dccb84b0a6f46c7/raw/57274f87c9d554ff76aeaab48f195abe0ef1ee99/Brain_Worms_v2.json"
        ],
        [
          "Hide & Seek",
          "https://gist.githubusercontent.com/LukeC82/64cb5ee4fb0efb4d1baf75964a477743/raw/453b456d004fe9d8463c39177c41c9c20ce897e7/Hide_&_Seek_v1.json"
        ],
        [
          "Harold Holt's Revenge",
          "https://gist.githubusercontent.com/LukeC82/0bee5191ee630d773007f0848320786e/raw/2e22f0f3d583a19c7b6222d5b964a2ae68064e78/Harold_Holts_Revenge.json"
        ],
        [
          "Murder by Death",
          "https://gist.githubusercontent.com/LukeC82/04789e52b4055d1dc07275bb81a1311c/raw/53a50a39bac097f2005fb264cfa19fe5cc856292/Murder_by_Death_v1.json"
        ]
      ],
      // scripts for the One Night Clocktower mode
      oneNightScripts: [
        [
          "One Night Ultimate Carl",
          "https://gist.githubusercontent.com/LukeC82/5aa733cb431dd1a8364e58023c880a11/raw/80a6b14ed94e2a9a53ea67478d349eb228c56ef5/One_Night_Ultimate_Carl_5_2_4.json"
        ],
        [
          "One Night Ultimate Carl Extreme",
          "https://gist.githubusercontent.com/LukeC82/ec5bbf29205ba013e289cecf7596bd88/raw/dd904ed62a3f9502b411911c9b191095ad2b43de/One_Night_Ultimate_Carl_Extreme.json"
        ]
      ]
    };
  },
  computed: mapState(["modals"]),
  methods: {
    openUpload() {
      this.$refs.upload.click();
    },
    handleUpload() {
      const file = this.$refs.upload.files[0];
      if (file && file.size) {
        const reader = new FileReader();
        reader.addEventListener("load", () => {
          try {
            const roles = JSON.parse(reader.result);
            this.parseRoles(roles);
          } catch (e) {
            alert("Error reading custom script: " + e.message);
          }
          this.$refs.upload.value = "";
        });
        reader.readAsText(file);
      }
    },
    promptURL() {
      const url = prompt("Enter URL to a custom-script.json file");
      if (url) {
        this.handleURL(url);
      }
    },
    async handleURL(url) {
      const res = await fetch(url);
      if (res && res.json) {
        try {
          const script = await res.json();
          this.parseRoles(script);
        } catch (e) {
          alert("Error loading custom script: " + e.message);
        }
      }
    },
    async readFromClipboard() {
      const text = await navigator.clipboard.readText();
      try {
        const roles = JSON.parse(text);
        this.parseRoles(roles);
      } catch (e) {
        alert("Error reading custom script: " + e.message);
      }
    },
    parseRoles(roles) {
      if (!roles || !roles.length) return;
      roles = roles.map(role =>
        typeof role === "string" ? { id: role } : role
      );
      const metaIndex = roles.findIndex(({ id }) => id === "_meta");
      let meta = {};
      if (metaIndex > -1) {
        meta = roles.splice(metaIndex, 1).pop();
      }
      this.$store.commit("setCustomRoles", roles);
      this.$store.commit(
        "setEdition",
        Object.assign({}, meta, { id: "custom" })
      );
      // check for fabled and set those too, if present
      if (roles.some(role => this.$store.state.fabled.has(role.id || role))) {
        const fabled = [];
        roles.forEach(role => {
          if (this.$store.state.fabled.has(role.id || role)) {
            fabled.push(this.$store.state.fabled.get(role.id || role));
          }
        });
        this.$store.commit("players/setFabled", { fabled });
      }
      this.isCustom = false;
    },
    ...mapMutations(["toggleModal", "setEdition"])
  }
};
</script>

<style scoped lang="scss">
ul.editions .edition {
  font-family: PiratesBay, sans-serif;
  letter-spacing: 1px;
  text-align: center;
  padding-top: 15%;
  background-position: center center;
  background-size: 100% auto;
  background-repeat: no-repeat;
  width: 20%;
  margin: 5px;
  font-size: 90%;
  text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000,
    1px 1px 0 #000, 0 0 5px rgba(0, 0, 0, 0.75);
  cursor: pointer;
  &:hover {
    color: red;
  }
}

.custom {
  text-align: center;
  input[type="file"] {
    display: none;
  }
  // two lists side by side; they stack on narrow screens
  .script-columns {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0 40px;
  }
  .script-column {
    flex: 1 1 260px;
    max-width: 420px;
  }
  .scripts {
    list-style-type: disc;
    font-size: 120%;
    cursor: pointer;
    display: block;
    text-align: left;
    margin: 10px 0;
    padding-left: 1.2em;
    li:hover {
      color: red;
    }
  }
}
</style>
