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

  clearAll() {
    safe(() => {
      ['playerName', 'playerImage', 'selectedCharacter'].forEach((k) => {
        sessionStorage.removeItem(k);
        localStorage.removeItem(k);
      });
    });
  }
};
