/**
 * API helper — wraps fetch with required headers for CSRF protection.
 * All frontend API calls should use this instead of raw fetch().
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export function apiHeaders(extra = {}) {
  return {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    ...extra,
  };
}

export async function apiFetch(path, options = {}) {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const headers = apiHeaders(options.headers);
  return fetch(url, { ...options, headers });
}

export async function apiGet(path, wallet = null) {
  const headers = { 'X-Requested-With': 'XMLHttpRequest' };
  if (wallet) headers['x-wallet-address'] = wallet;
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  return fetch(url, { headers });
}

export async function apiPost(path, body = {}, wallet = null) {
  const headers = apiHeaders();
  if (wallet) headers['x-wallet-address'] = wallet;
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  return fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}
