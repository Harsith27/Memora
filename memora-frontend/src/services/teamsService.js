// Teams Calendar Service — communicates with /api/teams backend routes

const API_BASE = import.meta.env.VITE_API_URL || '/api';

function getToken() {
  return localStorage.getItem('accessToken') || '';
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getToken()}`,
  };
}

/**
 * Fetch the current connection status for the logged-in user.
 * Returns { connected, connectedEmail, connectedAt, showInChronicle }
 */
export async function getTeamsStatus() {
  try {
    const res = await fetch(`${API_BASE}/teams/status`, { headers: authHeaders() });
    if (!res.ok) return { connected: false, connectedEmail: '', showInChronicle: true };
    return res.json();
  } catch {
    return { connected: false, connectedEmail: '', showInChronicle: true };
  }
}

/**
 * Open a Microsoft OAuth popup. Returns a Promise that resolves with
 * { success, email } when the popup completes (via postMessage).
 */
export async function connectTeams() {
  // 1. Get the auth URL from our backend
  const res = await fetch(`${API_BASE}/teams/auth-url`, { headers: authHeaders() });
  const data = await res.json();
  if (!data.success || !data.url) throw new Error(data.message || 'Could not get auth URL');

  // 2. Open popup
  return new Promise((resolve, reject) => {
    const width = 520;
    const height = 640;
    const left = Math.round(window.screenX + (window.outerWidth - width) / 2);
    const top = Math.round(window.screenY + (window.outerHeight - height) / 2);
    const popup = window.open(
      data.url,
      'teams-oauth',
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
    );

    if (!popup) {
      reject(new Error('Popup blocked. Please allow popups for this site.'));
      return;
    }

    const handler = (event) => {
      if (event.data?.type !== 'TEAMS_AUTH_COMPLETE') return;
      window.removeEventListener('message', handler);
      clearInterval(pollTimer);
      if (event.data.success) {
        resolve({ success: true, email: event.data.email });
      } else {
        reject(new Error(event.data.error || 'Authentication failed'));
      }
    };

    window.addEventListener('message', handler);

    // Fallback: detect popup closed manually
    const pollTimer = setInterval(() => {
      if (popup.closed) {
        clearInterval(pollTimer);
        window.removeEventListener('message', handler);
        reject(new Error('Popup closed without completing authentication'));
      }
    }, 500);
  });
}

/**
 * Toggle whether Teams events are shown in Chronicle.
 */
export async function toggleTeamsInChronicle(showInChronicle) {
  const res = await fetch(`${API_BASE}/teams/toggle`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ showInChronicle }),
  });
  return res.json();
}

/**
 * Disconnect the Teams integration.
 */
export async function disconnectTeams() {
  const res = await fetch(`${API_BASE}/teams/disconnect`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return res.json();
}

/**
 * Fetch Teams calendar events for a date range.
 * @param {string} start - YYYY-MM-DD
 * @param {string} end   - YYYY-MM-DD
 * @returns {Array} Chronicle-shaped event objects
 */
export async function fetchTeamsEvents(start, end) {
  try {
    const res = await fetch(
      `${API_BASE}/teams/events?start=${start}&end=${end}`,
      { headers: authHeaders() }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.events || [];
  } catch {
    return [];
  }
}

const teamsService = {
  getTeamsStatus,
  connectTeams,
  toggleTeamsInChronicle,
  disconnectTeams,
  fetchTeamsEvents,
};

export default teamsService;
