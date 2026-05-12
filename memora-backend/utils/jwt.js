const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const isProduction = String(process.env.NODE_ENV || '').toLowerCase() === 'production';

const requireSecret = (envName) => {
  const value = process.env[envName];
  if (value) {
    return value;
  }

  if (isProduction) {
    throw new Error(`${envName} is required. Refusing to start without explicit JWT secrets.`);
  }

  const generated = crypto.randomBytes(48).toString('hex');
  console.warn(`[JWT] ${envName} is missing. Generated an ephemeral development secret.`);
  return generated;
};

const JWT_SECRET = requireSecret('JWT_SECRET');
const JWT_REFRESH_SECRET = requireSecret('JWT_REFRESH_SECRET');
const JWT_EXPIRE = process.env.JWT_EXPIRE || '24h';
const JWT_REFRESH_EXPIRE = process.env.JWT_REFRESH_EXPIRE || '7d';

/**
 * Generate JWT access token
 * @param {Object} payload - User data to encode
 * @returns {String} JWT token
 */
const generateAccessToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { 
    expiresIn: JWT_EXPIRE,
    issuer: 'memora-api',
    audience: 'memora-client'
  });
};

/**
 * Generate JWT refresh token
 * @param {Object} payload - User data to encode
 * @returns {String} JWT refresh token
 */
const generateRefreshToken = (payload) => {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { 
    expiresIn: JWT_REFRESH_EXPIRE,
    issuer: 'memora-api',
    audience: 'memora-client'
  });
};

/**
 * Verify JWT access token
 * @param {String} token - JWT token to verify
 * @returns {Object} Decoded token payload
 */
const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET, {
      issuer: 'memora-api',
      audience: 'memora-client'
    });
  } catch (error) {
    throw new Error('Invalid or expired access token');
  }
};

/**
 * Verify JWT refresh token
 * @param {String} token - JWT refresh token to verify
 * @returns {Object} Decoded token payload
 */
const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET, {
      issuer: 'memora-api',
      audience: 'memora-client'
    });
  } catch (error) {
    throw new Error('Invalid or expired refresh token');
  }
};

/**
 * Generate both access and refresh tokens
 * @param {Object} user - User object
 * @returns {Object} Object containing both tokens
 */
const generateTokenPair = (user) => {
  const payload = {
    id: user._id || user.id,
    email: user.email,
    username: user.username
  };

  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload)
  };
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  generateTokenPair
};
