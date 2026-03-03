// Note: avoid importing socket.io-client at module top-level to prevent SSR bundling
// We'll dynamically import it inside connect() only on the client.

class SocketManager {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.roomId = null;
    this.playerId = null;
    this.playerName = null;
    this.callbacks = {};
    this.hasJoined = false;
    this.wasKicked = false;
  }

  resolveServerUrl(explicitServerUrl) {
    if (explicitServerUrl) return explicitServerUrl;
    const envUrl = (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_BASE_URL)
      ? String(process.env.NEXT_PUBLIC_API_BASE_URL)
      : '';
    if (envUrl) return envUrl.replace(/\/$/, '');
    if (typeof window !== 'undefined') {
      const host = window.location.hostname || 'localhost';
      return `http://${host}:5000`;
    }
    return 'http://localhost:5000';
  }

  connect(serverUrl) {
    const resolvedServerUrl = this.resolveServerUrl(serverUrl);
    // Only run on the client/browser
    if (typeof window === 'undefined') {
      console.warn('SocketManager.connect called on the server; skipping.');
      return this;
    }

    if (this.socket) {
      this.disconnect();
    }

    // Dynamic import to avoid SSR bundling issues
    import('socket.io-client')
      .then(({ io }) => {
        this.socket = io(resolvedServerUrl, {
          autoConnect: true,
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000
        });

        this.socket.on('connect', () => {
          console.log('Socket connected:', this.socket.id);
          this.isConnected = true;
          this.wasKicked = false;
          this.emit('connected', { socketId: this.socket.id });
        });

        this.socket.on('disconnect', (reason) => {
          console.log('Socket disconnected:', reason);
          this.isConnected = false;
          // allow re-join on reconnect
          this.hasJoined = false;
          this.emit('disconnected', { reason, wasKicked: this.wasKicked });
        });

        // Listen for room state updates
        this.socket.on('roomState', (data) => {
          this.emit('roomState', data);
        });

        this.socket.on('playerJoined', (data) => {
          this.emit('playerJoined', data);
        });

        this.socket.on('playerMoved', (data) => {
          this.emit('playerMoved', data);
        });

        // Forward when a player leaves (disconnects or is kicked)
        this.socket.on('playerLeft', (data) => {
          this.emit('playerLeft', data);
        });

        this.socket.on('questionAnswered', (data) => {
          this.emit('questionAnswered', data);
        });

        this.socket.on('gameProgress', (data) => {
          this.emit('gameProgress', data);
        });

        // Important: forward game start broadcast from server
        this.socket.on('gameStarted', (data) => {
          console.log('gameStarted event received from server:', data);
          this.emit('gameStarted', data);
        });

        // Forward game results and rankings
        this.socket.on('gameResults', (data) => {
          console.log('gameResults event received from server:', data);
          this.emit('gameResults', data);
        });

        // Forward per-answer updates broadcast by the server
        this.socket.on('answerSubmitted', (data) => {
          // Backwards-compatible aliases
          this.emit('questionAnswered', data);
          this.emit('gameProgress', data);
        });

        // Forward kick event to allow client UI to react (e.g., redirect)
        this.socket.on('kicked', (data) => {
          try {
            // Stop any auto-reconnect loop immediately
            // (server will also disconnect us, but we guard here too)
            this.wasKicked = true;
            this.socket.disconnect();
          } catch {}
          this.emit('kicked', data);
        });
      })
      .catch((err) => {
        console.error('Failed to load socket.io-client:', err);
      });

    return this;
  }

  // joinRoom now accepts an optional providedPlayerId which, if present, will be used
  // instead of restoring/generating from localStorage. This allows opening multiple
  // simulated clients in the same browser (different tabs) by passing unique ids.
  joinRoom(roomId, playerName, role = 'student', providedPlayerId = null) {
    if (!this.socket || !this.isConnected) {
      console.warn('Socket not connected, cannot join room');
      return false;
    }

    // Prevent duplicate joins for the same room and session
    if (this.hasJoined && this.roomId === roomId && !providedPlayerId) {
      return true;
    }

    this.roomId = roomId;
    this.playerName = playerName;

    // If caller provides an explicit playerId, use it. Otherwise generate/restore
    // a stable one in localStorage (per room+role) so reloads reuse same id.
    if (providedPlayerId) {
      this.playerId = providedPlayerId;
    } else if (typeof window !== 'undefined') {
      // Per-tab identity using sessionStorage so each tab is a distinct player by default
      const skey = `qq:sid:${roomId}:${role}`;
      const storedSession = window.sessionStorage.getItem(skey);
      if (storedSession) {
        this.playerId = storedSession;
      } else {
        const rand = Math.random().toString(36).slice(2, 6);
        this.playerId = `${playerName}_${Date.now()}_${rand}`;
        try { window.sessionStorage.setItem(skey, this.playerId); } catch {}
      }
    } else if (!this.playerId) {
      // Fallback for non-browser (shouldn't happen due to guards)
      this.playerId = `${playerName}_${Date.now()}`;
    }

    // Backend expects the field name to be 'name'
    this.socket.emit('joinRoom', {
      roomId,
      playerId: this.playerId,
      name: playerName,
      role
    });

    this.hasJoined = true;
    return true;
  }

  movePlayer(x, y) {
    if (!this.socket || !this.isConnected || !this.roomId) return false;

    this.socket.emit('playerMove', {
      roomId: this.roomId,
      playerId: this.playerId,
      x,
      y
    });

    return true;
  }

  answerQuestion(questionId, selectedIndex, correct, earned) {
    if (!this.socket || !this.isConnected || !this.roomId) return false;

    this.socket.emit('sendAnswer', {
      roomId: this.roomId,
      playerId: this.playerId,
      questionId,
      selectedIndex,
      correct,
      earned,
      timestamp: Date.now()
    });

    return true;
  }

  finishGame(score) {
    if (!this.socket || !this.isConnected || !this.roomId) return false;

    this.socket.emit('playerFinished', {
      roomId: this.roomId,
      playerId: this.playerId,
      score,
      timestamp: Date.now()
    });

    return true;
  }

  completeGame(finalScore, completionTime, questionsAnswered) {
    if (!this.socket || !this.isConnected || !this.roomId) return false;

    this.socket.emit('gameCompleted', {
      roomId: this.roomId,
      playerId: this.playerId,
      playerName: this.playerName,
      finalScore,
      completionTime,
      questionsAnswered,
      timestamp: Date.now()
    });

    return true;
  }

  // Direct socket emit for custom events
  socketEmit(event, data) {
    if (!this.socket || !this.isConnected) return false;
    this.socket.emit(event, data);
    return true;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected = false;
    this.roomId = null;
    // Preserve playerId across reconnects isn't necessary when component remounts,
    // but we keep it so a reconnect won't create a new ghost player id.
    // this.playerId = null;
    this.playerName = null;
    // Clear callbacks to avoid accumulating duplicate listeners across mounts
    this.callbacks = {};
    this.hasJoined = false;
  }

  // Event system
  on(event, callback) {
    if (!this.callbacks[event]) {
      this.callbacks[event] = [];
    }
    this.callbacks[event].push(callback);
  }

  off(event, callback) {
    if (!this.callbacks[event]) return;
    this.callbacks[event] = this.callbacks[event].filter(cb => cb !== callback);
  }

  emit(event, data) {
    if (this.callbacks[event]) {
      this.callbacks[event].forEach(callback => callback(data));
    }
  }

  // Getters
  getSocket() {
    return this.socket;
  }

  isSocketConnected() {
    return this.isConnected && this.socket?.connected;
  }

  getRoomId() {
    return this.roomId;
  }

  getPlayerId() {
    return this.playerId;
  }

  getPlayerName() {
    return this.playerName;
  }
}

// Create singleton instance
const socketManager = new SocketManager();

export default socketManager;