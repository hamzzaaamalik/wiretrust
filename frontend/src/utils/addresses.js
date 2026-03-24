const API_BASE = '/api';

export async function loadAddresses() {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  const data = await res.json();
  return data.contracts;
}

export const API = API_BASE;
