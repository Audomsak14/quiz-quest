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

export function withAuth(config = {}) {
  const headers = { ...(config.headers || {}), ...getAuthHeaders() };
  return { ...config, headers };
}