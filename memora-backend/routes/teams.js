const express = require('express');
const crypto = require('crypto');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// ─── Encryption helpers (AES-256-GCM) ────────────────────────────────────────
const ALGO = 'aes-256-gcm';
const getRawKey = () => {
  const k = process.env.TEAMS_TOKEN_ENCRYPT_KEY || 'memora-teams-token-encrypt-key-2025';
  return crypto.createHash('sha256').update(k).digest();
};

function encrypt(text) {
  if (!text) return '';
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGO, getRawKey(), iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decrypt(payload) {
  if (!payload) return '';
  try {
    const [ivHex, tagHex, dataHex] = payload.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const data = Buffer.from(dataHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGO, getRawKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}

// ─── MS Graph constants ───────────────────────────────────────────────────────
const MS_AUTHORITY = 'https://login.microsoftonline.com/common/oauth2/v2.0';
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const SCOPES = ['openid', 'profile', 'email', 'offline_access', 'Calendars.Read'].join(' ');

const getClientId = () => process.env.MS_CLIENT_ID || '';
const getClientSecret = () => process.env.MS_CLIENT_SECRET || '';
const getRedirectUri = () => process.env.MS_REDIRECT_URI || 'http://localhost:3001/api/teams/callback';

// ─── Token refresh helper ─────────────────────────────────────────────────────
async function refreshAccessToken(encryptedRefreshToken) {
  const refreshToken = decrypt(encryptedRefreshToken);
  if (!refreshToken) throw new Error('No refresh token available');

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: getClientId(),
    client_secret: getClientSecret(),
    refresh_token: refreshToken,
    scope: SCOPES,
  });

  const response = await fetch(`${MS_AUTHORITY}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Token refresh failed: ${err}`);
  }
  return response.json();
}

// ─── Get valid access token for user (auto-refresh if needed) ─────────────────
async function getValidAccessToken(user) {
  const integration = await User
    .findById(user._id || user.id)
    .select('+msTeamsIntegration.accessToken +msTeamsIntegration.refreshToken')
    .lean();

  const t = integration?.msTeamsIntegration;
  if (!t?.connected) throw new Error('Teams not connected');

  const expiresAt = t.tokenExpiresAt ? new Date(t.tokenExpiresAt) : new Date(0);
  const bufferMs = 5 * 60 * 1000;

  if (expiresAt.getTime() - Date.now() > bufferMs) {
    return decrypt(t.accessToken);
  }

  // Refresh
  const tokens = await refreshAccessToken(t.refreshToken);
  const newExpiry = new Date(Date.now() + tokens.expires_in * 1000);
  await User.findByIdAndUpdate(user._id || user.id, {
    'msTeamsIntegration.accessToken': encrypt(tokens.access_token),
    'msTeamsIntegration.refreshToken': encrypt(tokens.refresh_token || decrypt(t.refreshToken)),
    'msTeamsIntegration.tokenExpiresAt': newExpiry,
  });
  return tokens.access_token;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * GET /api/teams/auth-url
 * Returns the Microsoft OAuth URL for the frontend popup.
 */
router.get('/auth-url', authenticateToken, (req, res) => {
  if (!getClientId()) {
    return res.status(500).json({ success: false, message: 'MS_CLIENT_ID not configured' });
  }

  const state = Buffer.from(JSON.stringify({ userId: req.user.id, ts: Date.now() }))
    .toString('base64url');

  const params = new URLSearchParams({
    client_id: getClientId(),
    response_type: 'code',
    redirect_uri: getRedirectUri(),
    response_mode: 'query',
    scope: SCOPES,
    state,
    prompt: 'select_account',
  });

  res.json({ success: true, url: `${MS_AUTHORITY}/authorize?${params.toString()}` });
});

/**
 * GET /api/teams/callback
 * Handles Microsoft OAuth redirect. Exchanges code for tokens, saves encrypted to DB.
 * Returns an HTML page that posts a message to the opener popup and closes itself.
 */
router.get('/callback', async (req, res) => {
  const { code, state, error: msError, error_description } = req.query;

  if (msError) {
    return res.send(buildCallbackPage({ success: false, error: error_description || msError }));
  }
  if (!code || !state) {
    return res.send(buildCallbackPage({ success: false, error: 'Missing code or state' }));
  }

  let userId;
  try {
    const parsed = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
    userId = parsed.userId;
  } catch {
    return res.send(buildCallbackPage({ success: false, error: 'Invalid state parameter' }));
  }

  try {
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: getClientId(),
      client_secret: getClientSecret(),
      code,
      redirect_uri: getRedirectUri(),
      scope: SCOPES,
    });

    const tokenResponse = await fetch(`${MS_AUTHORITY}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams.toString(),
    });

    if (!tokenResponse.ok) {
      const errBody = await tokenResponse.text();
      throw new Error(`Token exchange failed: ${errBody}`);
    }

    const tokens = await tokenResponse.json();

    // Get the user's email from Graph
    const meResponse = await fetch(
      `${GRAPH_BASE}/me?$select=displayName,mail,userPrincipalName`,
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );
    const meData = meResponse.ok ? await meResponse.json() : {};
    const connectedEmail = meData.mail || meData.userPrincipalName || '';

    await User.findByIdAndUpdate(userId, {
      'msTeamsIntegration.connected': true,
      'msTeamsIntegration.accessToken': encrypt(tokens.access_token),
      'msTeamsIntegration.refreshToken': encrypt(tokens.refresh_token || ''),
      'msTeamsIntegration.tokenExpiresAt': new Date(Date.now() + tokens.expires_in * 1000),
      'msTeamsIntegration.connectedEmail': connectedEmail,
      'msTeamsIntegration.connectedAt': new Date(),
      'msTeamsIntegration.showInChronicle': true,
    });

    return res.send(buildCallbackPage({ success: true, email: connectedEmail }));
  } catch (err) {
    console.error('[Teams] Callback error:', err.message);
    return res.send(buildCallbackPage({ success: false, error: err.message }));
  }
});

/**
 * GET /api/teams/events?start=YYYY-MM-DD&end=YYYY-MM-DD
 * Returns calendar events for the given window from Microsoft Graph.
 */
router.get('/events', authenticateToken, async (req, res) => {
  try {
    const { start, end } = req.query;
    if (!start || !end) {
      return res.status(400).json({ success: false, message: 'start and end query params required' });
    }

    const dbUser = await User.findById(req.user.id).select('msTeamsIntegration').lean();
    if (!dbUser?.msTeamsIntegration?.connected || !dbUser.msTeamsIntegration.showInChronicle) {
      return res.json({ success: true, events: [] });
    }

    const accessToken = await getValidAccessToken(req.user);

    const graphUrl =
      `${GRAPH_BASE}/me/calendarView` +
      `?startDateTime=${encodeURIComponent(start + 'T00:00:00')}` +
      `&endDateTime=${encodeURIComponent(end + 'T23:59:59')}` +
      `&$select=id,subject,start,end,bodyPreview,onlineMeeting,isOnlineMeeting,organizer` +
      `&$orderby=start/dateTime` +
      `&$top=50`;

    const graphResponse = await fetch(graphUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Prefer: 'outlook.timezone="UTC"',
      },
    });

    if (!graphResponse.ok) {
      const errBody = await graphResponse.text();
      console.error('[Teams] Graph API error:', errBody);
      return res.status(502).json({ success: false, message: 'Graph API error' });
    }

    const graphData = await graphResponse.json();
    const rawEvents = graphData.value || [];

    const events = rawEvents.map((ev) => {
      const startObj = new Date(`${ev.start?.dateTime}Z`);
      const endObj = new Date(`${ev.end?.dateTime}Z`);
      const durationMins = Math.max(15, Math.round((endObj - startObj) / 60000));
      const timeStr = `${String(startObj.getUTCHours()).padStart(2, '0')}:${String(startObj.getUTCMinutes()).padStart(2, '0')}`;
      const dateStr = startObj.toISOString().split('T')[0];

      return {
        id: `teams-${ev.id}`,
        title: ev.subject || 'Meeting',
        description: ev.bodyPreview || '',
        date: dateStr,
        time: timeStr,
        duration: durationMins,
        type: 'meeting',
        color: 'indigo',
        source: 'teams',
        meetingUrl: ev.onlineMeeting?.joinUrl || null,
        organizer: ev.organizer?.emailAddress?.name || '',
      };
    });

    res.json({ success: true, events });
  } catch (err) {
    console.error('[Teams] Events error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/teams/status
 * Returns connection status (no sensitive data).
 */
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const dbUser = await User.findById(req.user.id).select('msTeamsIntegration').lean();
    const t = dbUser?.msTeamsIntegration || {};
    res.json({
      success: true,
      connected: Boolean(t.connected),
      connectedEmail: t.connectedEmail || '',
      connectedAt: t.connectedAt || null,
      showInChronicle: t.showInChronicle !== false,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PATCH /api/teams/toggle
 * Toggles showInChronicle on/off.
 */
router.patch('/toggle', authenticateToken, async (req, res) => {
  try {
    const show = Boolean(req.body.showInChronicle);
    await User.findByIdAndUpdate(req.user.id, {
      'msTeamsIntegration.showInChronicle': show,
    });
    res.json({ success: true, showInChronicle: show });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * DELETE /api/teams/disconnect
 * Clears all stored tokens.
 */
router.delete('/disconnect', authenticateToken, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, {
      'msTeamsIntegration.connected': false,
      'msTeamsIntegration.accessToken': '',
      'msTeamsIntegration.refreshToken': '',
      'msTeamsIntegration.tokenExpiresAt': null,
      'msTeamsIntegration.connectedEmail': '',
      'msTeamsIntegration.connectedAt': null,
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Callback popup HTML page ─────────────────────────────────────────────────
function buildCallbackPage({ success, email = '', error = '' }) {
  const payload = JSON.stringify({ success, email, error });
  return `<!DOCTYPE html><html lang="en">
<head><meta charset="UTF-8"><title>Memora — Teams</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:system-ui,sans-serif;background:#0a0a0a;color:#fff;
       display:flex;align-items:center;justify-content:center;min-height:100vh;}
  .card{text-align:center;padding:2.5rem 2rem;max-width:340px;}
  .icon{font-size:3.5rem;margin-bottom:1rem;line-height:1;}
  h2{font-size:1.1rem;font-weight:600;margin-bottom:0.5rem;}
  p{color:#6b7280;font-size:0.8rem;line-height:1.5;}
  .email{color:#a5b4fc;font-size:0.85rem;margin-bottom:0.75rem;font-weight:500;}
</style></head>
<body><div class="card">
  <div class="icon">${success ? '✅' : '❌'}</div>
  ${success ? `<h2>Connected!</h2><p class="email">${email}</p><p>You can close this window.</p>`
             : `<h2>Connection failed</h2><p>${error}</p>`}
</div>
<script>
  try {
    if (window.opener) window.opener.postMessage({ type:'TEAMS_AUTH_COMPLETE', ...(${payload}) }, '*');
  } catch(e){}
  setTimeout(() => window.close(), 2500);
</script></body></html>`;
}

module.exports = router;
