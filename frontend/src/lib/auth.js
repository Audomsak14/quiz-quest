export function getAuthHeaders() {
  try {
    if (typeof window !== 'undefined') {
      // Prefer sessionStorage to avoid cross-tab/account token bleed
      const sToken = window.sessionStorage?.getItem('token');
      if (sToken) return { Authorization: `Bearer ${sToken}` };
      // Fallback to localStorage for older flows
      const lToken = window.localStorage?.getItem('token');
      if (lToken) return { Authorization: `Bearer ${lToken}` };
    }
  } catch {}
  return {};
}

export function getAuthSession() {
  try {
    if (typeof window === 'undefined') {
      return { token: '', role: '', userId: '', username: '' };
    }
    const get = (key) => {
      try {
        return (
          window.sessionStorage?.getItem(key) ||
          window.localStorage?.getItem(key) ||
          ''
        );
      } catch {
        return '';
      }
    };
    return {
      token: get('token'),
      role: get('role'),
      userId: get('userId'),
      username: get('username'),
    };
  } catch {
    return { token: '', role: '', userId: '', username: '' };
  }
}

export function isLoggedIn() {
  return Boolean(getAuthSession().token);
}

export function clearAuthSession() {
  try {
    if (typeof window === 'undefined') return;
    const keys = ['token', 'role', 'userId', 'username', 'user'];
    for (const k of keys) {
      try { window.sessionStorage?.removeItem(k); } catch {}
      try { window.localStorage?.removeItem(k); } catch {}
    }
  } catch {}
}

export function withAuth(config = {}) {
  const headers = { ...(config.headers || {}), ...getAuthHeaders() };
  return { ...config, headers };
}