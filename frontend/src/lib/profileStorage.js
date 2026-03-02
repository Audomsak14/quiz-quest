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

const PROFILE_PREFIX = 'qq-profile:';

const getActiveUsername = () => safe(() => {
  const fromSession = (sessionStorage.getItem('username') || '').trim();
  if (fromSession) return fromSession;
  const fromLocal = (localStorage.getItem('username') || '').trim();
  return fromLocal;
}, '');

const getProfileKey = () => {
  const username = getActiveUsername();
  return username ? `${PROFILE_PREFIX}${username}` : '';
};

const readProfile = () => safe(() => {
  const key = getProfileKey();
  if (!key) return null;
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  return parsed && typeof parsed === 'object' ? parsed : null;
}, null);

const writeProfile = (patch) => {
  safe(() => {
    const key = getProfileKey();
    if (!key) return;
    const current = readProfile() || {};
    const next = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(key, JSON.stringify(next));
  });
};

export const profileStorage = {
  // Stable playerId (use for identity across rooms and history)
  getId() {
    return safe(() => {
      // Prefer sessionStorage for this tab; fall back to localStorage
      let id = sessionStorage.getItem('playerId');
      if (!id) id = localStorage.getItem('playerId');
      if (!id) {
        const profile = readProfile();
        id = profile?.playerId || '';
      }
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
        writeProfile({ playerId: '' });
      } else {
        sessionStorage.setItem('playerId', String(id));
        localStorage.setItem('playerId', String(id));
        writeProfile({ playerId: String(id) });
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
    return safe(() => {
      const sessionName = sessionStorage.getItem('playerName') || '';
      if (sessionName) return sessionName;
      const profileName = readProfile()?.playerName || '';
      if (profileName) {
        try { sessionStorage.setItem('playerName', profileName); } catch {}
      }
      return profileName;
    }, '');
  },
  setName(name) {
    safe(() => {
      if (name == null) {
        sessionStorage.removeItem('playerName');
        writeProfile({ playerName: '' });
      } else {
        const value = String(name);
        sessionStorage.setItem('playerName', value);
        writeProfile({ playerName: value });
      }
      // Purge old value to avoid confusion
      localStorage.removeItem('playerName');
    });
  },

  // Avatar image (base64 or URL)
  getImage() {
    return safe(() => {
      let raw = sessionStorage.getItem('playerImage') || '';
      if (!raw) {
        raw = readProfile()?.playerImage || '';
        if (raw) {
          try { sessionStorage.setItem('playerImage', raw); } catch {}
        }
      }
      if (!raw) return '';

      // If the stored avatar is one of our built-in sprite sheets, force a
      // known cache-busting version so asset updates are reflected immediately.
      const CHARACTER_ASSET_VERSION = '2026-02-24-old';
      const base = String(raw).split('?')[0];
      if (
        base === '/characters/boy-sprite-8x1.svg' ||
        base === '/characters/girl-sprite-8x1.svg'
      ) {
        return `${base}?v=${CHARACTER_ASSET_VERSION}`;
      }

      return String(raw);
    }, '');
  },
  setImage(image) {
    safe(() => {
      if (!image) {
        sessionStorage.removeItem('playerImage');
        writeProfile({ playerImage: '' });
      }
      else {
        const value = String(image);
        sessionStorage.setItem('playerImage', value);
        writeProfile({ playerImage: value });
      }
      localStorage.removeItem('playerImage');
    });
  },

  // Emoji/character id
  getCharacterId() {
    return safe(() => {
      const sessionCharacter = sessionStorage.getItem('selectedCharacter') || '';
      if (sessionCharacter) return sessionCharacter;
      const profileCharacter = readProfile()?.selectedCharacter || '';
      if (profileCharacter) {
        try { sessionStorage.setItem('selectedCharacter', profileCharacter); } catch {}
      }
      return profileCharacter;
    }, '');
  },
  setCharacterId(id) {
    safe(() => {
      if (!id) {
        sessionStorage.removeItem('selectedCharacter');
        writeProfile({ selectedCharacter: '' });
      }
      else {
        const value = String(id);
        sessionStorage.setItem('selectedCharacter', value);
        writeProfile({ selectedCharacter: value });
      }
      localStorage.removeItem('selectedCharacter');
    });
  },

  // Avatar config (JSON)
  getAvatarConfig() {
    return safe(() => {
      let raw = sessionStorage.getItem('avatarConfig') || '';
      if (!raw) {
        const profileAvatarConfig = readProfile()?.avatarConfig || null;
        if (profileAvatarConfig) {
          raw = JSON.stringify(profileAvatarConfig);
          try { sessionStorage.setItem('avatarConfig', raw); } catch {}
        }
      }
      if (!raw) return null;
      try { return JSON.parse(raw); } catch { return null; }
    }, null);
  },
  setAvatarConfig(cfg) {
    safe(() => {
      if (!cfg) {
        sessionStorage.removeItem('avatarConfig');
        writeProfile({ avatarConfig: null });
      }
      else {
        sessionStorage.setItem('avatarConfig', JSON.stringify(cfg));
        writeProfile({ avatarConfig: cfg });
      }
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
