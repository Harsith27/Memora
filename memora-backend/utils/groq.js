const keys = [
  process.env.GROQ_API_KEY1,
  process.env.GROQ_API_KEY2,
  process.env.GROQ_API_KEY3,
  process.env.GROQ_API_KEY
].map(k => String(k || '').trim())
 .filter(k => k && k.toLowerCase() !== 'null' && k.toLowerCase() !== 'undefined');

const cooldowns = new Map();
let currentIndex = 0;

const normalizeGroqApiKey = (value) => {
  const s = String(value || '').trim();
  if (!s || s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined') return '';
  return s;
};

/**
 * Returns the next available healthy Groq API key.
 * If all keys are rate-limited, ignores cooldowns and falls back.
 */
function getApiKey() {
  if (keys.length === 0) return '';

  const now = Date.now();
  const availableKeys = keys.filter(k => {
    const expires = cooldowns.get(k) || 0;
    return now > expires;
  });

  const activeKeys = availableKeys.length > 0 ? availableKeys : keys;
  const key = activeKeys[currentIndex % activeKeys.length];
  currentIndex = (currentIndex + 1) % activeKeys.length;
  return key;
}

/**
 * Marks an API key as rate-limited (on cooldown) for 60 seconds.
 */
function markRateLimited(key) {
  if (!key) return;
  console.warn(`[groq-balancer] Key ${key.slice(0, 10)}... rate limited. Cooldown active for 60s.`);
  cooldowns.set(key, Date.now() + 60000);
}

/**
 * Custom fetch wrapper that automatically load-balances requests across available Groq keys.
 * If a userId is provided, it attempts to load and use the user's custom Groq API key first.
 */
async function fetchGroq(url, options = {}, userId = '') {
  let userKeys = [];
  
  if (userId) {
    try {
      const User = require('../models/User');
      const user = await User.findById(userId).select('preferences.groqApiKey').lean();
      const rawKey = user?.preferences?.groqApiKey || '';
      userKeys = rawKey.split(',')
        .map(k => String(k || '').trim())
        .filter(k => k && k.toLowerCase() !== 'null' && k.toLowerCase() !== 'undefined');
    } catch (err) {
      console.error('[groq-balancer] Failed to load user custom API keys:', err.message);
    }
  }

  if (userKeys.length > 0) {
    const maxAttempts = Math.max(1, userKeys.length);
    let attempts = 0;
    let lastError = null;

    while (attempts < maxAttempts) {
      const now = Date.now();
      const availableUserKeys = userKeys.filter(k => {
        const expires = cooldowns.get(k) || 0;
        return now > expires;
      });

      const activeUserKeys = availableUserKeys.length > 0 ? availableUserKeys : userKeys;
      const customKey = activeUserKeys[attempts % activeUserKeys.length];

      const headers = {
        ...options.headers,
        'Authorization': `Bearer ${customKey}`
      };

      try {
        const response = await fetch(url, { ...options, headers });

        if (response.status === 401 || response.status === 403) {
          throw new Error('API_KEY_INVALID');
        }

        if (response.status === 429) {
          markRateLimited(customKey);
          attempts++;
          continue;
        }

        return response;
      } catch (err) {
        if (err.message === 'API_KEY_INVALID') {
          throw err;
        }
        lastError = err;
        attempts++;
      }
    }

    if (lastError?.message === 'API_KEY_INVALID') {
      throw lastError;
    }
    throw new Error('API_KEY_QUOTA_EXCEEDED');
  }

  // Fallback to balanced system keys
  const maxAttempts = Math.max(1, keys.length);
  let attempts = 0;
  let lastError = null;

  while (attempts < maxAttempts) {
    const key = getApiKey();
    if (!key) {
      throw new Error('No Groq API keys configured in environment variables');
    }

    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${key}`
    };

    try {
      const response = await fetch(url, { ...options, headers });
      
      // If we got a Rate Limit response, rotate the key and try again
      if (response.status === 429) {
        markRateLimited(key);
        attempts++;
        continue;
      }
      
      return response;
    } catch (err) {
      console.error(`[groq-balancer] Request attempt failed with network error:`, err);
      lastError = err;
      attempts++;
    }
  }

  throw lastError || new Error('All Groq API keys are currently rate-limited or unavailable');
}

module.exports = {
  getApiKey,
  markRateLimited,
  fetchGroq,
  normalizeGroqApiKey
};
