// exported for unit tests; the app uses the default export below
export class LiveSession {
  constructor(store) {
    // `npm run serve` (see dev-tools/) uses the local server started with
    // NODE_ENV=development; production builds use the live server.
    this._wss =
      process.env.NODE_ENV === "development"
        ? "ws://localhost:8081/"
        : "wss://live.axistownsquare.com:8080/";
    this._socket = null;
    this._isSpectator = true;
    this._gamestate = [];
    this._store = store;
    this._pingInterval = 30 * 1000; // 30 seconds between pings
    this._pingTimer = null;
    this._reconnectTimer = null;
    this._pointVoteSyncTimer = null;
    this._players = {}; // map of players connected to a session
    this._pings = {}; // map of player IDs to ping
    // reconnect to previous session
    if (this._store.state.session.sessionId) {
      this.connect(this._store.state.session.sessionId);
    }
  }

  /**
   * Open a new session for the passed channel.
   * @param channel
   * @private
   */
  _open(channel) {
    this.disconnect();
    this._socket = new WebSocket(
      this._wss +
        channel +
        "/" +
        (this._isSpectator ? this._store.state.session.playerId : "host")
    );
    this._socket.addEventListener("message", this._handleMessage.bind(this));
    this._socket.onopen = this._onOpen.bind(this);
    this._socket.onclose = err => {
      this._socket = null;
      clearInterval(this._pingTimer);
      this._pingTimer = null;
      if (err.code !== 1000) {
        // connection interrupted, reconnect after 3 seconds
        this._store.commit("session/setReconnecting", true);
        this._reconnectTimer = setTimeout(
          () => this.connect(channel),
          3 * 1000
        );
      } else {
        this._store.commit("session/setSessionId", "");
        if (err.reason) alert(err.reason);
      }
    };
  }

  /**
   * Send a message through the socket.
   * @param command
   * @param params
   * @private
   */
  _send(command, params) {
    if (this._socket && this._socket.readyState === 1) {
      this._socket.send(JSON.stringify([command, params]));
    }
  }

  /**
   * Send a message directly to a single playerId, if provided.
   * Otherwise broadcast it.
   * @param playerId player ID or "host", optional
   * @param command
   * @param params
   * @private
   */
  _sendDirect(playerId, command, params) {
    if (playerId) {
      this._send("direct", { [playerId]: [command, params] });
    } else {
      this._send(command, params);
    }
  }

  /**
   * Open event handler for socket.
   * @private
   */
  _onOpen() {
    if (this._isSpectator) {
      this._sendDirect(
        "host",
        "getGamestate",
        this._store.state.session.playerId
      );
    } else {
      this.sendGamestate();
    }
    this._ping();
  }

  /**
   * Send a ping message with player ID and ST flag.
   * @private
   */
  _ping() {
    this._handlePing();
    this._send("ping", [
      this._isSpectator
        ? this._store.state.session.playerId
        : Object.keys(this._players).length,
      "latency"
    ]);
    // ST: send a direct keepalive to each connected player to prevent
    // browser timer throttling from causing spurious disconnections
    if (!this._isSpectator) {
      for (const playerId of Object.keys(this._players)) {
        this._sendDirect(playerId, "keepalive", null);
      }
    }
    clearTimeout(this._pingTimer);
    this._pingTimer = setTimeout(this._ping.bind(this), this._pingInterval);
  }

  /**
   * Handle an incoming socket message.
   * @param data
   * @private
   */
  _handleMessage({ data }) {
    let command, params;
    try {
      [command, params] = JSON.parse(data);
    } catch (err) {
      console.log("unsupported socket message", data);
    }
    switch (command) {
      case "getGamestate":
        this.sendGamestate(params);
        break;
      case "edition":
        this._updateEdition(params);
        break;
      case "fabled":
        this._updateFabled(params);
        break;
      case "gs":
        this._updateGamestate(params);
        break;
      case "player":
        this._updatePlayer(params);
        break;
      case "claim":
        this._updateSeat(params);
        break;
      case "ping":
        this._handlePing(params);
        break;
      case "keepalive":
        // ST is keeping our connection alive — respond with an immediate ping
        // to reset our eviction clock and counteract browser timer throttling
        this._ping();
        break;
      case "nomination":
        if (!this._isSpectator) return;
        if (!params) {
          // create vote history record
          this._store.commit(
            "session/addHistory",
            this._store.state.players.players
          );
        }
        this._store.commit("session/nomination", { nomination: params });
        break;
      case "swap":
        if (!this._isSpectator) return;
        this._store.commit("players/swap", params);
        break;
      case "move":
        if (!this._isSpectator) return;
        this._store.commit("players/move", params);
        break;
      case "remove":
        if (!this._isSpectator) return;
        this._store.commit("players/remove", params);
        break;
      case "marked":
        if (!this._isSpectator) return;
        this._store.commit("session/setMarkedPlayer", params);
        break;
      case "isNight":
        if (!this._isSpectator) return;
        this._store.commit("session/toggleNight", params);
        break;
      case "isHiddenVoting":
        if (!this._isSpectator) return;
        this._store.commit("session/toggleHiddenVoting", params);
        break;
      case "isReturnToTown":
        if (!this._isSpectator) return;
        this._store.commit("session/toggleReturnToTown", params);
        break;
      case "isOneNight":
        if (!this._isSpectator) return;
        this._store.commit("session/toggleOneNight", params);
        break;
      case "gameEnded":
        if (!this._isSpectator) return;
        if (params) this._store.commit("session/declareVictory", params);
        else this._store.commit("session/clearVictory");
        break;
      case "victoryReveal":
        if (!this._isSpectator) return;
        if (params) this._store.commit("session/setVictoryReveal", params);
        else this._store.commit("session/clearVictoryReveal");
        break;
      case "isVoteHistoryAllowed":
        if (!this._isSpectator) return;
        this._store.commit("session/setVoteHistoryAllowed", params);
        this._store.commit("session/clearVoteHistory");
        break;
      case "votingSpeed":
        if (!this._isSpectator) return;
        this._store.commit("session/setVotingSpeed", params);
        break;
      case "clearVoteHistory":
        if (!this._isSpectator) return;
        this._store.commit("session/clearVoteHistory");
        break;
      case "isVoteInProgress":
        if (!this._isSpectator) return;
        this._store.commit("session/setVoteInProgress", params);
        break;
      case "vote":
        this._handleVote(params);
        break;
      case "lock":
        this._handleLock(params);
        break;
      case "bye":
        this._handleBye(params);
        break;
      case "pronouns":
        this._updatePlayerPronouns(params);
        break;
      case "handRaised":
        this._updateHandRaised(params);
        break;
      case "pointVoteActive":
        if (!this._isSpectator) return;
        this._store.commit("session/setPointVoteActive", params);
        break;
      case "pointVote": {
        const { session } = this._store.state;
        if (!session.pointVoteActive) return;
        const hadVoted = session.pointVotes[params.voterIndex] !== undefined;
        this._store.commit("session/castPointVote", params);
        const hasVoted = session.pointVotes[params.voterIndex] !== undefined;
        // Secret Point Vote: tell players who has voted, never what they voted.
        // Only send when someone starts or withdraws a vote, to keep the ST
        // well under the server's message rate limit.
        if (!this._isSpectator && session.isOneNight && hadVoted !== hasVoted) {
          this.syncPointVotes();
        }
        break;
      }
      case "pointVotesSync":
        this._store.commit("session/setPointVotes", params || {});
        break;
      case "pointVoteVoters":
        if (!this._isSpectator) return;
        this._store.commit("session/setPointVoteVoters", params);
        break;
      case "pointVoteReveal": {
        if (!this._isSpectator) return;
        const { votes, order } = params || {};
        this._store.commit("session/setPointVotes", votes || {});
        this._store.commit("session/startPointVoteReveal", order);
        break;
      }
      case "rerack":
        this._applyRerack();
        break;
      case "leaderboard":
        if (!this._isSpectator) return;
        this._store.commit("leaderboard/receive", params);
        break;
      case "leaderboardRequest":
        this._sendLeaderboardCopy();
        break;
      case "leaderboardCopy":
        if (this._isSpectator) return;
        this._store.commit("leaderboard/addRecovered", params);
        break;
      case "pointVoteRevealSkip":
        if (!this._isSpectator) return;
        this._store.commit("session/skipPointVoteReveal");
        break;
      case "pointVoteCountdown":
        if (!this._isSpectator) return;
        this._store.commit("session/setPointVoteCountdown", params);
        break;
      case "pointVoteEnded":
        if (!this._isSpectator) return;
        if (!params) {
          this._store.commit(
            "session/addPointVoteHistory",
            this._store.state.players.players
          );
        }
        this._store.commit("session/setPointVoteEnded", params);
        break;
    }
  }

  /**
   * Connect to a new live session, either as host or spectator.
   * Set a unique playerId if there isn't one yet.
   * @param channel
   */
  connect(channel) {
    if (!this._store.state.session.playerId) {
      this._store.commit(
        "session/setPlayerId",
        Math.random()
          .toString(36)
          .slice(2)
      );
    }
    this._pings = {};
    this._store.commit("session/setPlayerCount", 0);
    this._store.commit("session/setPing", 0);
    this._isSpectator = this._store.state.session.isSpectator;
    this._open(channel);
  }

  /**
   * Close the current session, if any.
   */
  disconnect() {
    this._pings = {};
    this._store.commit("session/setPlayerCount", 0);
    this._store.commit("session/setPing", 0);
    this._store.commit("session/setReconnecting", false);
    clearTimeout(this._reconnectTimer);
    if (this._socket) {
      if (this._isSpectator) {
        this._sendDirect("host", "bye", this._store.state.session.playerId);
      }
      this._socket.close(1000);
      this._socket = null;
    }
  }

  /**
   * Publish the current gamestate.
   * Optional param to reduce traffic. (send only player data)
   * @param playerId
   * @param isLightweight
   */
  sendGamestate(playerId = "", isLightweight = false) {
    if (this._isSpectator) return;
    const { session } = this._store.state;
    const { fabled } = this._store.state.players;
    if (session.isHiddenVoting && session.nomination) return;
    // Secret Point Vote: players only learn who has voted until the reveal
    const pointVotesHidden = session.isOneNight && !session.pointVoteRevealed;
    const pointVoteVoters = Object.keys(session.pointVotes).map(Number);
    //When Hidden Voting, obscure ghost vote & marked player from the game state update
    if (session.isHiddenVoting) {
      this._gamestate = this._store.state.players.players.map(player => ({
        name: player.name,
        id: player.id,
        isDead: player.isDead,
        handRaised: player.handRaised,
        pronouns: player.pronouns,
        ...(player.role && player.role.team === "traveler"
          ? { roleId: player.role.id }
          : {})
      }));
    } else {
      this._gamestate = this._store.state.players.players.map(player => ({
        name: player.name,
        id: player.id,
        isDead: player.isDead,
        handRaised: player.handRaised,
        isVoteless: player.isVoteless,
        pronouns: player.pronouns,
        ...(player.role && player.role.team === "traveler"
          ? { roleId: player.role.id }
          : {})
      }));
    }
    if (isLightweight) {
      this._sendDirect(playerId, "gs", {
        gamestate: this._gamestate,
        isLightweight
      });
    } else {
      this.sendEdition(playerId);
      if (session.isHiddenVoting) {
        this._sendDirect(playerId, "gs", {
          gamestate: this._gamestate,
          isNight: session.isNight,
          isHiddenVoting: session.isHiddenVoting,
          isReturnToTown: session.isReturnToTown,
          isOneNight: session.isOneNight,
          isVoteHistoryAllowed: session.isVoteHistoryAllowed,
          nomination: session.nomination,
          votingSpeed: session.votingSpeed,
          lockedVote: session.lockedVote,
          isVoteInProgress: session.isVoteInProgress,
          fabled: fabled.map(f => (f.isCustom ? f : { id: f.id })),
          pointVoteActive: session.pointVoteActive,
          pointVotes: pointVotesHidden ? {} : session.pointVotes,
          pointVoteEnded: session.pointVoteEnded,
          pointVoteRevealed: session.pointVoteRevealed,
          pointVoteRevealOrder: session.pointVoteRevealOrder,
          ...(session.isOneNight
            ? { leaderboard: this._store.getters["leaderboard/board"] }
            : {}),
          pointVoteVoters,
          gameEnded: session.gameEnded,
          winningTeam: session.winningTeam,
          victoryCount: session.victoryCount,
          victoryRevealActive: session.victoryRevealActive,
          victoryRevealSnapshot: session.victoryRevealSnapshot,
          ...(session.nomination ? { votes: session.votes } : {})
        });
      } else {
        this._sendDirect(playerId, "gs", {
          gamestate: this._gamestate,
          isNight: session.isNight,
          isHiddenVoting: session.isHiddenVoting,
          isReturnToTown: session.isReturnToTown,
          isOneNight: session.isOneNight,
          isVoteHistoryAllowed: session.isVoteHistoryAllowed,
          nomination: session.nomination,
          votingSpeed: session.votingSpeed,
          lockedVote: session.lockedVote,
          isVoteInProgress: session.isVoteInProgress,
          // One Night: the leaders' skulls stay with the ST until the reveal
          markedPlayer: pointVotesHidden ? -1 : session.markedPlayer,
          ...(session.isOneNight
            ? { markedPlayers: pointVotesHidden ? [] : session.markedPlayers }
            : {}),
          fabled: fabled.map(f => (f.isCustom ? f : { id: f.id })),
          pointVoteActive: session.pointVoteActive,
          pointVotes: pointVotesHidden ? {} : session.pointVotes,
          pointVoteEnded: session.pointVoteEnded,
          pointVoteRevealed: session.pointVoteRevealed,
          pointVoteRevealOrder: session.pointVoteRevealOrder,
          ...(session.isOneNight
            ? { leaderboard: this._store.getters["leaderboard/board"] }
            : {}),
          pointVoteVoters,
          gameEnded: session.gameEnded,
          winningTeam: session.winningTeam,
          victoryCount: session.victoryCount,
          victoryRevealActive: session.victoryRevealActive,
          victoryRevealSnapshot: session.victoryRevealSnapshot,
          ...(session.nomination ? { votes: session.votes } : {})
        });
      }
    }
  }

  /**
   * Update the gamestate based on incoming data.
   * @param data
   * @private
   */
  _updateGamestate(data) {
    if (!this._isSpectator) return;
    const {
      gamestate,
      isLightweight,
      isNight,
      isHiddenVoting,
      isReturnToTown,
      isOneNight,
      isVoteHistoryAllowed,
      nomination,
      votingSpeed,
      votes,
      lockedVote,
      isVoteInProgress,
      markedPlayer,
      markedPlayers,
      fabled,
      pointVoteActive,
      pointVotes,
      pointVoteEnded,
      pointVoteRevealed,
      pointVoteRevealOrder,
      pointVoteVoters,
      leaderboard,
      gameEnded,
      winningTeam,
      victoryCount,
      victoryRevealActive,
      victoryRevealSnapshot
    } = data;
    const players = this._store.state.players.players;
    // adjust number of players
    if (players.length < gamestate.length) {
      for (let x = players.length; x < gamestate.length; x++) {
        this._store.commit("players/add", gamestate[x].name);
      }
    } else if (players.length > gamestate.length) {
      for (let x = players.length; x > gamestate.length; x--) {
        this._store.commit("players/remove", x - 1);
      }
    }
    // update status for each player
    gamestate.forEach((state, x) => {
      const player = players[x];
      const { roleId } = state;
      // update relevant properties
      ["name", "id", "isDead", "isVoteless", "pronouns", "handRaised"].forEach(
        property => {
          const value = state[property];
          if (player[property] !== value) {
            this._store.commit("players/update", { player, property, value });
          }
        }
      );
      // roles are special, because of travelers
      if (roleId && player.role.id !== roleId) {
        const role =
          this._store.state.roles.get(roleId) ||
          this._store.getters.rolesJSONbyId.get(roleId);
        if (role) {
          this._store.commit("players/update", {
            player,
            property: "role",
            value: role
          });
        }
      } else if (!roleId && player.role.team === "traveler") {
        this._store.commit("players/update", {
          player,
          property: "role",
          value: {}
        });
      }
    });
    if (!isLightweight) {
      this._store.commit("session/toggleNight", !!isNight);
      this._store.commit("session/toggleHiddenVoting", !!isHiddenVoting);
      this._store.commit("session/toggleReturnToTown", !!isReturnToTown);
      this._store.commit("session/toggleOneNight", !!isOneNight);
      this._store.commit("session/setVoteHistoryAllowed", isVoteHistoryAllowed);
      if (!isVoteHistoryAllowed) {
        this._store.commit("session/clearVoteHistory");
      }
      this._store.commit("session/nomination", {
        nomination,
        votes,
        votingSpeed,
        lockedVote,
        isVoteInProgress
      });
      this._store.commit(
        "session/setMarkedPlayer",
        isOneNight ? markedPlayers : markedPlayer
      );
      this._store.commit("players/setFabled", {
        fabled: fabled.map(f => this._store.state.fabled.get(f.id) || f)
      });
      // In an unrevealed Secret Point Vote the ST sends no votes, so keep
      // this player's own vote rather than wiping it.
      const keepOwnVote = !!isOneNight && !pointVoteRevealed;
      const local = this._store.state.session;
      if (pointVoteActive) {
        if (!keepOwnVote || !local.pointVoteActive) {
          this._store.commit("session/setPointVoteActive", true);
        }
        if (!keepOwnVote) {
          this._store.commit("session/setPointVotes", pointVotes || {});
        }
      } else {
        // The ST's state is authoritative: a vote this client still has open
        // (missed close message, ST refresh, server restart, or a previous
        // session in the same tab) must not survive the sync.
        if (local.pointVoteActive) {
          this._store.commit("session/setPointVoteActive", false);
        }
        if (pointVoteEnded) {
          if (!keepOwnVote) {
            this._store.commit("session/setPointVotes", pointVotes || {});
          }
          this._store.commit("session/setPointVoteEnded", true);
        } else if (local.pointVoteEnded) {
          this._store.commit("session/setPointVoteEnded", false);
        }
      }
      this._store.commit("session/setPointVoteVoters", pointVoteVoters);
      this._store.commit("session/setPointVoteRevealed", !!pointVoteRevealed);
      // late joiners land on the finished reveal; a reveal already playing
      // here (e.g. the ST reconnected mid-reveal) carries on undisturbed
      if (
        pointVoteRevealed &&
        !this._store.getters["session/pointVoteRevealing"]
      ) {
        this._store.commit(
          "session/restorePointVoteReveal",
          pointVoteRevealOrder
        );
      }
      if (leaderboard) {
        this._store.commit("leaderboard/receive", leaderboard);
      }
      if (gameEnded && winningTeam) {
        this._store.commit("session/setVictoryCount", victoryCount || 0);
        this._store.commit("session/declareVictory", winningTeam);
      } else {
        this._store.commit("session/clearVictory");
      }
      if (victoryRevealActive && victoryRevealSnapshot) {
        this._store.commit("session/setVictoryReveal", victoryRevealSnapshot);
      } else {
        this._store.commit("session/clearVictoryReveal");
      }
    }
  }

  /**
   * Players: the ST is reracking. Clear this screen for the next game, the
   * same as their own Remove all: their own character, and the characters,
   * reminders and good/evil marks they placed as notes. Travellers stay
   * (they come from the ST); deaths, ghost votes and raised hands come from
   * the ST's update. A player who missed it uses Remove all, as usual.
   * @private
   */
  _applyRerack() {
    if (!this._isSpectator) return;
    this._store.dispatch("players/clearRoles");
    this._store.commit("session/resetSelfAlignments");
    // close the victory celebration from the last game
    this._store.commit("session/clearVictory");
    this._store.commit(
      "session/showNotice",
      "The Storyteller is reracking for a new game!"
    );
  }

  /**
   * Publish an edition update. ST only
   * @param playerId
   */
  sendEdition(playerId = "") {
    if (this._isSpectator) return;
    const { edition } = this._store.state;
    let roles;
    if (!edition.isOfficial) {
      roles = this._store.getters.customRolesStripped;
    }
    this._sendDirect(playerId, "edition", {
      edition: edition.isOfficial ? { id: edition.id } : edition,
      ...(roles ? { roles } : {})
    });
  }

  /**
   * Update edition and roles for custom editions.
   * @param edition
   * @param roles
   * @private
   */
  _updateEdition({ edition, roles }) {
    if (!this._isSpectator) return;
    this._store.commit("setEdition", edition);
    if (roles) {
      this._store.commit("setCustomRoles", roles);
      if (this._store.state.roles.size !== roles.length) {
        const missing = [];
        roles.forEach(({ id }) => {
          if (!this._store.state.roles.get(id)) {
            missing.push(id);
          }
        });
        alert(
          `This session contains custom characters that can't be found. ` +
            `Please load them before joining! ` +
            `Missing roles: ${missing.join(", ")}`
        );
        this.disconnect();
        this._store.commit("toggleModal", "edition");
      }
    }
  }

  /**
   * Publish a fabled update. ST only
   */
  sendFabled() {
    if (this._isSpectator) return;
    const { fabled } = this._store.state.players;
    this._send(
      "fabled",
      fabled.map(f => (f.isCustom ? f : { id: f.id }))
    );
  }

  /**
   * Update fabled roles.
   * @param fabled
   * @private
   */
  _updateFabled(fabled) {
    if (!this._isSpectator) return;
    this._store.commit("players/setFabled", {
      fabled: fabled.map(f => this._store.state.fabled.get(f.id) || f)
    });
  }

  /**
   * Publish a player update.
   * @param player
   * @param property
   * @param value
   */
  sendPlayer({ player, property, value }) {
    if (this._isSpectator || property === "reminders") return;
    const index = this._store.state.players.players.indexOf(player);
    if (property === "role") {
      if (value.team && value.team === "traveler") {
        // update local gamestate to remember this player as a traveler
        this._gamestate[index].roleId = value.id;
        this._send("player", {
          index,
          property,
          value: value.id
        });
      } else if (this._gamestate[index].roleId) {
        // player was previously a traveler
        delete this._gamestate[index].roleId;
        this._send("player", { index, property, value: "" });
      }
    } else {
      this._send("player", { index, property, value });
    }
  }

  /**
   * Update a player based on incoming data. Player only.
   * @param index
   * @param property
   * @param value
   * @private
   */
  _updatePlayer({ index, property, value }) {
    if (!this._isSpectator) return;
    const player = this._store.state.players.players[index];
    if (!player) return;
    // special case where a player stops being a traveler
    if (property === "role") {
      if (!value && player.role.team === "traveler") {
        // reset to an unknown role
        this._store.commit("players/update", {
          player,
          property: "role",
          value: {}
        });
      } else {
        // load role, first from session, the global, then fail gracefully
        const role =
          this._store.state.roles.get(value) ||
          this._store.getters.rolesJSONbyId.get(value) ||
          {};
        this._store.commit("players/update", {
          player,
          property: "role",
          value: role
        });
      }
    } else {
      // See if you spent your own ghost vote during hidden voting.
      if (
        this._store.state.session.playerId !== player.id &&
        property === "isVoteless" &&
        this._store.state.session.isHiddenVoting &&
        value != player.isVoteless
      ) {
        this._store.commit("players/update", {
          player,
          property: "isVoteless",
          value: player.isVoteless
        });
      } else {
        // just update the player otherwise
        this._store.commit("players/update", { player, property, value });
      }
    }
  }

  /**
   * Publish a player pronouns update
   * @param player
   * @param value
   * @param isFromSockets
   */
  sendPlayerPronouns({ player, value, isFromSockets }) {
    //send pronoun only for the seated player or storyteller
    //Do not re-send pronoun data for an update that was recieved from the sockets layer
    if (
      isFromSockets ||
      (this._isSpectator && this._store.state.session.playerId !== player.id)
    )
      return;
    const index = this._store.state.players.players.indexOf(player);
    this._send("pronouns", [index, value]);
  }

  /**
   * Publish a player's raised hand update
   * @param player
   * @param value
   * @param isFromSockets
   */
  sendHandRaised({ player, value, isFromSockets }) {
    //send handRaised only for the seated player or storyteller
    //Do not re-send pronoun data for an update that was recieved from the sockets layer
    if (
      isFromSockets ||
      (this._isSpectator && this._store.state.session.playerId !== player.id)
    )
      return;
    const index = this._store.state.players.players.indexOf(player);
    this._send("handRaised", [index, value]);
  }

  /**
   * Update a pronouns based on incoming data.
   * @param index
   * @param value
   * @private
   */
  _updatePlayerPronouns([index, value]) {
    const player = this._store.state.players.players[index];

    this._store.commit("players/update", {
      player,
      property: "pronouns",
      value,
      isFromSockets: true
    });
  }

  /**
   * Update a hand raised state based on incoming data.
   * @param index
   * @param value
   * @private
   */
  _updateHandRaised([index, value]) {
    const player = this._store.state.players.players[index];

    this._store.commit("players/update", {
      player,
      property: "handRaised",
      value,
      isFromSockets: true
    });
  }

  /**
   * Handle a ping message by another player / storyteller
   * @param playerIdOrCount
   * @param latency
   * @private
   */
  _handlePing([playerIdOrCount = 0, latency] = []) {
    const now = new Date().getTime();
    if (!this._isSpectator) {
      // remove players that haven't sent a ping in twice the timespan
      for (let player in this._players) {
        if (now - this._players[player] > this._pingInterval * 2) {
          delete this._players[player];
          delete this._pings[player];
        }
      }
      // remove claimed seats from players that are no longer connected
      this._store.state.players.players.forEach(player => {
        if (player.id && !this._players[player.id]) {
          this._store.commit("players/update", {
            player,
            property: "id",
            value: ""
          });
        }
      });
      // store new player data
      if (playerIdOrCount) {
        this._players[playerIdOrCount] = now;
        const ping = parseInt(latency, 10);
        if (ping && ping > 0 && ping < 30 * 1000) {
          // ping to Players
          this._pings[playerIdOrCount] = ping;
          const pings = Object.values(this._pings);
          this._store.commit(
            "session/setPing",
            Math.round(pings.reduce((a, b) => a + b, 0) / pings.length)
          );
        }
      }
    } else if (latency) {
      // ping to ST
      this._store.commit("session/setPing", parseInt(latency, 10));
    }
    // update player count
    if (!this._isSpectator || playerIdOrCount) {
      this._store.commit(
        "session/setPlayerCount",
        this._isSpectator ? playerIdOrCount : Object.keys(this._players).length
      );
    }
  }

  /**
   * Handle a player leaving the sessions. ST only
   * @param playerId
   * @private
   */
  _handleBye(playerId) {
    if (this._isSpectator) return;
    delete this._players[playerId];
    this._store.commit(
      "session/setPlayerCount",
      Object.keys(this._players).length
    );
  }

  /**
   * Claim a seat, needs to be confirmed by the Storyteller.
   * Seats already occupied can't be claimed.
   * @param seat either -1 to vacate or the index of the seat claimed
   */
  claimSeat(seat) {
    if (!this._isSpectator) return;
    const players = this._store.state.players.players;
    if (players.length > seat && (seat < 0 || !players[seat].id)) {
      this._send("claim", [seat, this._store.state.session.playerId]);
    }
  }

  /**
   * Update a player id associated with that seat.
   * @param index seat index or -1
   * @param value playerId to add / remove
   * @private
   */
  _updateSeat([index, value]) {
    if (this._isSpectator) return;
    const property = "id";
    const players = this._store.state.players.players;
    // remove previous seat
    const oldIndex = players.findIndex(({ id }) => id === value);
    if (oldIndex >= 0 && oldIndex !== index) {
      this._store.commit("players/update", {
        player: players[oldIndex],
        property,
        value: ""
      });
    }
    // add playerId to new seat
    if (index >= 0) {
      const player = players[index];
      if (!player) return;
      this._store.commit("players/update", { player, property, value });
    }
    // update player session list as if this was a ping
    this._handlePing([true, value, 0]);
  }

  /**
   * Distribute player roles to all seated players in a direct message.
   * This will be split server side so that each player only receives their own (sub)message.
   */
  distributeRoles() {
    if (this._isSpectator) return;
    const message = {};
    this._store.state.players.players.forEach((player, index) => {
      if (player.id && player.role) {
        message[player.id] = [
          "player",
          { index, property: "role", value: player.role.id }
        ];
      }
    });
    if (Object.keys(message).length) {
      this._send("direct", message);
    }
  }

  /**
   * A player nomination. ST only
   * This also syncs the voting speed to the players.
   * Payload can be an object with {nomination} property or just the nomination itself, or undefined.
   * @param payload [nominator, nominee]|{nomination}
   */
  nomination(payload) {
    if (this._isSpectator) return;
    const nomination = payload ? payload.nomination || payload : payload;
    const players = this._store.state.players.players;
    if (
      !nomination ||
      (players.length > nomination[0] && players.length > nomination[1])
    ) {
      this.setVotingSpeed(this._store.state.session.votingSpeed);
      this._send("nomination", nomination);
    }
  }

  /**
   * Set the isVoteInProgress status. ST only
   */
  setVoteInProgress() {
    if (this._isSpectator) return;
    this._send("isVoteInProgress", this._store.state.session.isVoteInProgress);
  }

  /**
   * Set the isHiddenVoting status.
   */
  setHiddenVoting() {
    if (this._isSpectator) return;
    this._send("isHiddenVoting", this._store.state.session.isHiddenVoting);
    //When ending hidden voting, refresh the gamestate for all players
    if (!this._store.state.session.isHiddenVoting) {
      this.sendGamestate();
    }
  }

  setReturnToTown() {
    if (this._isSpectator) return;
    this._send("isReturnToTown", this._store.state.session.isReturnToTown);
    //this.sendGamestate();
  }

  /**
   * Send the One Night Clocktower mode status. ST only
   */
  setOneNight() {
    if (this._isSpectator) return;
    this._send("isOneNight", this._store.state.session.isOneNight);
  }

  sendGameEnded() {
    if (this._isSpectator) return;
    const { gameEnded, winningTeam } = this._store.state.session;
    this._send("gameEnded", gameEnded ? winningTeam : null);
  }

  /**
   * Broadcast the victory reveal snapshot to all players. ST only.
   */
  sendVictoryReveal() {
    if (this._isSpectator) return;
    const {
      victoryRevealActive,
      victoryRevealSnapshot
    } = this._store.state.session;
    this._send(
      "victoryReveal",
      victoryRevealActive ? victoryRevealSnapshot : null
    );
  }

  /**
   * Send the isNight status. ST only
   */
  setIsNight() {
    if (this._isSpectator) return;
    this._send("isNight", this._store.state.session.isNight);
  }

  /**
   * Send the isVoteHistoryAllowed state. ST only
   */
  setVoteHistoryAllowed() {
    if (this._isSpectator) return;
    this._send(
      "isVoteHistoryAllowed",
      this._store.state.session.isVoteHistoryAllowed
    );
  }

  /**
   * Send the voting speed. ST only
   * @param votingSpeed voting speed in seconds, minimum 1
   */
  setVotingSpeed(votingSpeed) {
    if (this._isSpectator) return;
    if (votingSpeed) {
      this._send("votingSpeed", votingSpeed);
    }
  }

  /**
   * Send which player(s) are on the block. ST only
   */
  setMarked() {
    if (this._isSpectator) return;
    const session = this._store.state.session;
    if (session.isHiddenVoting) return;
    // One Night: skulls on the top-voted players are for the ST until the
    // votes are shown; clearing marks is always sent
    if (!session.isOneNight) {
      this._send("marked", session.markedPlayer);
      return;
    }
    const marks = session.markedPlayers;
    if (marks.length && !session.pointVoteRevealed) return;
    this._send("marked", marks);
  }

  /**
   * Clear the vote history for everyone. ST only
   */
  clearVoteHistory() {
    if (this._isSpectator) return;
    this._send("clearVoteHistory");
  }

  /**
   * Send a vote. Player or ST
   * @param index Seat of the player
   * @param sync Flag whether to sync this vote with others or not
   */
  vote([index]) {
    const player = this._store.state.players.players[index];

    // send vote only if it is your own vote or you are the storyteller
    if (
      this._store.state.session.playerId === player.id ||
      !this._isSpectator
    ) {
      //During hidden voting, only send vote data directly to the ST
      //If the ST has changed a vote, send that directly to the player
      if (this._store.state.session.isHiddenVoting) {
        this._sendDirect("host", "vote", [
          index,
          this._store.state.session.votes[index],
          !this._isSpectator
        ]);
      } else {
        // broadcast the vote to the socket
        this._send("vote", [
          index,
          this._store.state.session.votes[index],
          !this._isSpectator
        ]);
      }
    }
  }

  /**
   * Handle an incoming vote, but only if it is from ST or unlocked.
   * @param index
   * @param vote
   * @param fromST
   */
  _handleVote([index, vote, fromST]) {
    const { session, players } = this._store.state;
    const playerCount = players.players.length;
    const indexAdjusted =
      (index - 1 + playerCount - session.nomination[1]) % playerCount;
    if (fromST || indexAdjusted >= session.lockedVote - 1) {
      this._store.commit("session/vote", [index, vote]);
    }
  }

  /**
   * Lock a vote. ST only
   */
  lockVote() {
    if (this._isSpectator) return;
    const { lockedVote, votes, nomination } = this._store.state.session;
    const { players } = this._store.state.players;
    const index = (nomination[1] + lockedVote - 1) % players.length;
    this._send("lock", [this._store.state.session.lockedVote, votes[index]]);
  }

  /**
   * Update vote lock and the locked vote, if it differs. Player only
   * @param lock
   * @param vote
   * @private
   */
  _handleLock([lock, vote]) {
    if (!this._isSpectator) return;
    this._store.commit("session/lockVote", lock);
    if (lock > 1) {
      const { lockedVote, nomination } = this._store.state.session;
      const { players } = this._store.state.players;
      const index = (nomination[1] + lockedVote - 1) % players.length;
      if (
        this._store.state.session.votes[index] !== vote &&
        !this._store.state.session.isHiddenVoting
      ) {
        this._store.commit("session/vote", [index, vote]);
      }
    }
  }

  /**
   * Swap two player seats. ST only
   * @param payload
   */
  swapPlayer(payload) {
    if (this._isSpectator) return;
    this._send("swap", payload);
  }

  /**
   * Move a player to another seat. ST only
   * @param payload
   */
  movePlayer(payload) {
    if (this._isSpectator) return;
    this._send("move", payload);
  }

  /**
   * Remove a player. ST only
   * @param payload
   */
  removePlayer(payload) {
    if (this._isSpectator) return;
    this._send("remove", payload);
  }

  /**
   * Broadcast point vote active state. ST only.
   */
  setPointVoteActive() {
    if (this._isSpectator) return;
    this._send("pointVoteActive", this._store.state.session.pointVoteActive);
  }

  /**
   * Broadcast the full pointVotes map to all clients for reconciliation. ST only.
   */
  syncPointVotes() {
    if (this._isSpectator) return;
    const {
      pointVotes,
      isOneNight,
      pointVoteRevealed
    } = this._store.state.session;
    if (isOneNight && !pointVoteRevealed) {
      this._send("pointVoteVoters", Object.keys(pointVotes).map(Number));
    } else {
      this._send("pointVotesSync", pointVotes);
    }
  }

  /**
   * Reveal every Secret Point Vote to the town. ST only.
   */
  revealPointVotes() {
    if (this._isSpectator) return;
    const { pointVotes, pointVoteRevealOrder } = this._store.state.session;
    this._send("pointVoteReveal", {
      votes: pointVotes,
      order: pointVoteRevealOrder
    });
    // the skulls held back until now can be shown to the town
    this.setMarked();
  }

  /**
   * Rerack: tell every player to clear their screen for the next game.
   * ST only.
   */
  sendRerack() {
    if (this._isSpectator) return;
    this._send("rerack");
  }

  /**
   * Send the One Night session leaderboard to every player. ST only.
   */
  sendLeaderboard() {
    if (this._isSpectator) return;
    if (!this._store.state.session.isOneNight) return;
    this._send("leaderboard", this._store.getters["leaderboard/board"]);
  }

  /**
   * Recover scores: ask every player for their saved copy. ST only.
   */
  requestLeaderboardCopies() {
    if (this._isSpectator) return;
    this._send("leaderboardRequest");
  }

  /**
   * Answer Recover scores with this player's saved copy, if they have one.
   * @private
   */
  _sendLeaderboardCopy() {
    if (!this._isSpectator) return;
    const { copy } = this._store.state.leaderboard;
    if (!copy || !copy.games.length) return;
    const { playerId } = this._store.state.session;
    const seat = this._store.state.players.players.find(
      player => player.id === playerId
    );
    this._sendDirect("host", "leaderboardCopy", {
      name: (seat && seat.name) || "A player",
      board: copy
    });
  }

  /**
   * Skip the vote reveal straight to the result for everyone. ST only.
   */
  skipPointVoteReveal() {
    if (this._isSpectator) return;
    this._send("pointVoteRevealSkip");
  }

  /**
   * Broadcast a point vote cast by a player or received from a player.
   * @param payload { voterIndex, targetIndex }
   */
  castPointVote(payload) {
    // Secret Point Vote: only the ST may see a player's vote
    if (this._store.state.session.isOneNight) {
      this._sendDirect("host", "pointVote", payload);
    } else {
      this._send("pointVote", payload);
    }
  }

  /**
   * Broadcast point vote countdown state. ST only.
   */
  setPointVoteCountdown() {
    if (this._isSpectator) return;
    this._send(
      "pointVoteCountdown",
      this._store.state.session.pointVoteCountdown
    );
  }

  /**
   * Broadcast point vote ended state. ST only.
   */
  setPointVoteEnded() {
    if (this._isSpectator) return;
    this._send("pointVoteEnded", this._store.state.session.pointVoteEnded);
  }
}

export default store => {
  // setup
  const session = new LiveSession(store);

  // listen to mutations
  store.subscribe(({ type, payload }, state) => {
    switch (type) {
      case "session/setSessionId":
        if (state.session.sessionId) {
          session.connect(state.session.sessionId);
        } else {
          window.location.hash = "";
          session.disconnect();
        }
        break;
      case "session/claimSeat":
        session.claimSeat(payload);
        break;
      case "session/distributeRoles":
        if (payload) {
          session.distributeRoles();
        }
        break;
      case "session/nomination":
      case "session/setNomination":
        session.nomination(payload);
        break;
      case "session/setVoteInProgress":
        session.setVoteInProgress(payload);
        break;
      case "session/voteSync":
        session.vote(payload);
        break;
      case "session/lockVote":
        session.lockVote();
        break;
      case "session/setVotingSpeed":
        session.setVotingSpeed(payload);
        break;
      case "session/clearVoteHistory":
        session.clearVoteHistory();
        break;
      case "session/setVoteHistoryAllowed":
        session.setVoteHistoryAllowed();
        break;
      case "session/toggleNight":
        session.setIsNight();
        break;
      case "session/toggleHiddenVoting":
        session.setHiddenVoting();
        break;
      case "session/toggleReturnToTown":
        session.setReturnToTown();
        break;
      case "session/toggleOneNight":
        session.setOneNight();
        // players joining the mode see the session's scores straight away
        session.sendLeaderboard();
        break;
      case "leaderboard/startGame":
      case "leaderboard/bankGame":
      case "leaderboard/removeGame":
      case "leaderboard/reset":
      case "leaderboard/set":
        session.sendLeaderboard();
        break;
      case "leaderboard/requestCopies":
        session.requestLeaderboardCopies();
        break;
      case "session/startRerack":
        session.sendRerack();
        break;
      case "setEdition":
        session.sendEdition();
        break;
      case "players/setFabled":
        session.sendFabled();
        break;
      case "session/setMarkedPlayer":
        session.setMarked();
        break;
      case "session/setPointVoteActive":
        session.setPointVoteActive();
        clearInterval(session._pointVoteSyncTimer);
        session._pointVoteSyncTimer = null;
        if (store.state.session.pointVoteActive) {
          session._pointVoteSyncTimer = setInterval(
            () => session.syncPointVotes(),
            2000
          );
        }
        break;
      case "session/castPointVoteSync":
        session.castPointVote(payload);
        break;
      case "session/startPointVoteReveal":
        session.revealPointVotes();
        break;
      case "session/skipPointVoteReveal":
        session.skipPointVoteReveal();
        break;
      case "session/setPointVoteCountdown":
        session.setPointVoteCountdown();
        break;
      case "session/declareVictory":
        session.sendGameEnded();
        break;
      case "session/setVictoryReveal":
      case "session/clearVictoryReveal":
        session.sendVictoryReveal();
        break;
      case "session/setPointVoteEnded":
        clearInterval(session._pointVoteSyncTimer);
        session._pointVoteSyncTimer = null;
        // Broadcast final snapshot before ending so all clients land on identical results
        if (payload) session.syncPointVotes();
        session.setPointVoteEnded();
        break;
      case "players/swap":
        session.swapPlayer(payload);
        store.commit("session/swapOneNightVotes", payload);
        break;
      case "players/move":
        session.movePlayer(payload);
        store.commit("session/moveOneNightVotes", payload);
        break;
      case "players/remove":
        store.commit("session/removePlayerFromPointVotes", payload);
        session.removePlayer(payload);
        break;
      case "players/set":
      case "players/clear":
      case "players/add":
        session.sendGamestate("", true);
        break;
      case "players/update":
        if (payload.property === "pronouns") {
          session.sendPlayerPronouns(payload);
        } else if (payload.property === "handRaised") {
          session.sendHandRaised(payload);
        } else if (payload.property === "alignment") {
          // ST-only: alignment is never broadcast — visible to ST and self only
        } else {
          session.sendPlayer(payload);
        }
        break;
    }
  });

  // Re-ping immediately when a player returns to the tab, so their seat is
  // confirmed without waiting up to 30 seconds for the next scheduled ping
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && session._socket) {
      session._ping();
    }
  });

  // check for session Id in hash
  const sessionId = window.location.hash.slice(1);
  if (sessionId) {
    store.commit("session/setSpectator", true);
    store.commit("session/setSessionId", sessionId);
    store.commit("toggleGrimoire", false);
  }
};
