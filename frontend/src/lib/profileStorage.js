// Lightweight profile storage helper using sessionStorage by default.
// This prevents cross-account leaks because sessionStorage is per-tab.

const safe = (fn, fallback = null) => {
  try {
    if (typeof window === 'undefined') return fallback;
    return fn();
  } catch (_) {
    return fallback;
  }
};

export const profileStorage = {
  // Stable playerId (use for identity across rooms and history)
  getId() {
    return safe(() => {
      // Prefer sessionStorage for this tab; fall back to localStorage
      let id = sessionStorage.getItem('playerId');
      if (!id) id = localStorage.getItem('playerId');
      // If found in local but not in session, copy it so this tab uses the same id
      if (id && !sessionStorage.getItem('playerId')) {
        try { sessionStorage.setItem('playerId', id); } catch {}
      }
      return id || '';
    }, '');
  },
  setId(id) {
    safe(() => {
      if (!id) {
        sessionStorage.removeItem('playerId');
        localStorage.removeItem('playerId');
      } else {
        sessionStorage.setItem('playerId', String(id));
        localStorage.setItem('playerId', String(id));
      }
    });
  },
  ensureId(seedName = '') {
    let id = this.getId();
    if (id) return id;
    // Generate a stable-ish random id; include optional name hint for readability
    const rand = Math.random().toString(36).slice(2, 8);
    const ts = Date.now().toString(36);
    const namePart = (seedName || this.getName() || 'player').replace(/\W+/g, '').slice(0, 12) || 'player';
    id = `qq-${namePart}-${ts}-${rand}`;
    this.setId(id);
    return id;
  },
  // Name
  getName() {
    return safe(() => sessionStorage.getItem('playerName') || '', '');
  },
  setName(name) {
    safe(() => {
      if (name == null) {
        sessionStorage.removeItem('playerName');
      } else {
        sessionStorage.setItem('playerName', String(name));
      }
      // Purge old value to avoid confusion
      localStorage.removeItem('playerName');
    });
  },

  // Avatar image (base64 or URL)
  getImage() {
    return safe(() => sessionStorage.getItem('playerImage') || '', '');
  },
  setImage(image) {
    safe(() => {
      if (!image) sessionStorage.removeItem('playerImage');
      else sessionStorage.setItem('playerImage', String(image));
      localStorage.removeItem('playerImage');
    });
  },

  // Emoji/character id
  getCharacterId() {
    return safe(() => sessionStorage.getItem('selectedCharacter') || '', '');
  },
  setCharacterId(id) {
    safe(() => {
      if (!id) sessionStorage.removeItem('selectedCharacter');
      else sessionStorage.setItem('selectedCharacter', String(id));
      localStorage.removeItem('selectedCharacter');
    });
  },

  // Avatar config (JSON)
  getAvatarConfig() {
    return safe(() => {
      const raw = sessionStorage.getItem('avatarConfig') || '';
      if (!raw) return null;
      try { return JSON.parse(raw); } catch { return null; }
    }, null);
  },
  setAvatarConfig(cfg) {
    safe(() => {
      if (!cfg) sessionStorage.removeItem('avatarConfig');
      else sessionStorage.setItem('avatarConfig', JSON.stringify(cfg));
    });
  },

  clearAll() {
    safe(() => {
      ['playerId', 'playerName', 'playerImage', 'selectedCharacter'].forEach((k) => {
        sessionStorage.removeItem(k);
        localStorage.removeItem(k);
      });
      sessionStorage.removeItem('avatarConfig');
    });
  }
};
