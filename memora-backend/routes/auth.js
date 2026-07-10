const express = require('express');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const emailUtil = require('../utils/email');
const { generateTokenPair, verifyRefreshToken } = require('../utils/jwt');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Validation rules
const registerValidation = [
  body('username')
    .customSanitizer((value) => String(value || '').trim().toLowerCase())
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-z0-9]+$/)
    .withMessage('Username can only contain lowercase letters and numbers'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number')
];

const loginValidation = [
  body('email')
    .notEmpty()
    .withMessage('Email or username is required'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

const forgotPasswordValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email')
];

const resetPasswordValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('code')
    .matches(/^\d{6}$/)
    .withMessage('Reset code must be a 6-digit number'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number')
];

// Helper function to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', registerValidation, handleValidationErrors, async (req, res) => {
  try {
    const { email, password } = req.body;
    const username = String(req.body.username || '').trim().toLowerCase();

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [
        { email: email.toLowerCase() },
        { username: username }
      ]
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: existingUser.email === email.toLowerCase() 
          ? 'Email already registered' 
          : 'Username already taken'
      });
    }

    // Create new user
    const user = new User({
      username,
      email: email.toLowerCase(),
      password
    });

    await user.save();

    // Generate tokens
    const tokens = generateTokenPair(user);

    // Add refresh token to user
    const refreshTokenExpiry = new Date();
    refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 7); // 7 days
    await user.addRefreshToken(tokens.refreshToken, refreshTokenExpiry);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        bio: user.bio,
        location: user.location,
        website: user.website,
        phoneNumber: user.phoneNumber,
        dateOfBirth: user.dateOfBirth,
        occupation: user.occupation,
        education: user.education,
        interests: user.interests,
        memScore: user.memScore,
        hasCompletedEvaluation: user.hasCompletedEvaluation,
        lastMemScoreUpdate: user.lastMemScoreUpdate,
        preferences: user.preferences,
        profileIconId: user.profileIconId,
        currentStreak: user.currentStreak,
        longestStreak: user.longestStreak,
        totalStudyDays: user.totalStudyDays
      },
      tokens
    });

  } catch (error) {
    console.error('Registration error:', error);
    
    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(409).json({
        success: false,
        message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`
      });
    }

    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', loginValidation, handleValidationErrors, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email or username
    const user = await User.findByEmailOrUsername(email).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Update last login
    await user.updateLastLogin();

    // Generate tokens
    const tokens = generateTokenPair(user);

    // Add refresh token to user
    const refreshTokenExpiry = new Date();
    refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 7); // 7 days
    await user.addRefreshToken(tokens.refreshToken, refreshTokenExpiry);

    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        bio: user.bio,
        location: user.location,
        website: user.website,
        phoneNumber: user.phoneNumber,
        dateOfBirth: user.dateOfBirth,
        occupation: user.occupation,
        education: user.education,
        interests: user.interests,
        memScore: user.memScore,
        hasCompletedEvaluation: user.hasCompletedEvaluation,
        lastMemScoreUpdate: user.lastMemScoreUpdate,
        preferences: user.preferences,
        profileIconId: user.profileIconId,
        lastLogin: user.lastLogin,
        currentStreak: user.currentStreak,
        longestStreak: user.longestStreak,
        totalStudyDays: user.totalStudyDays
      },
      tokens
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Generate and issue a 6-digit reset code
 * @access  Public
 */
router.post('/forgot-password', forgotPasswordValidation, handleValidationErrors, async (req, res) => {
  try {
    const email = String(req.body.email || '').toLowerCase();
    const user = await User.findOne({ email }).select('+resetPasswordCodeRequestedAt');

    if (!user || !user.isActive) {
      return res.json({
        success: true,
        message: 'If this email exists, a 6-digit reset code has been sent.'
      });
    }

    const now = Date.now();
    const cooldownMs = 60 * 1000;
    const lastRequestAt = user.resetPasswordCodeRequestedAt ? new Date(user.resetPasswordCodeRequestedAt).getTime() : 0;

    if (lastRequestAt && (now - lastRequestAt) < cooldownMs) {
      return res.status(429).json({
        success: false,
        message: 'Please wait at least 60 seconds before requesting another code.'
      });
    }

    const code = String(crypto.randomInt(100000, 1000000));
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    const expiresAt = new Date(now + (10 * 60 * 1000));

    user.resetPasswordCodeHash = codeHash;
    user.resetPasswordCodeExpiresAt = expiresAt;
    user.resetPasswordCodeRequestedAt = new Date(now);
    user.resetPasswordCodeAttempts = 0;
    await user.save();

    if (!emailUtil.isEmailConfigured()) {
      console.warn('Forgot password requested but email service is not configured.');

      // Only return the reset code in the API response when explicitly allowed
      // (useful for local/dev testing). In production, do not expose the code.
      const allowReturnCode = process.env.ALLOW_RESET_CODE_IN_RESPONSE === 'true' || process.env.NODE_ENV !== 'production';

      if (allowReturnCode) {
        return res.json({
          success: true,
          message: 'Email service is not configured. Use the reset code shown here to continue.',
          resetCode: code
        });
      }

      return res.status(503).json({
        success: false,
        message: 'Email service is not configured. Please contact support or try again later.'
      });
    }

    try {
      await emailUtil.sendResetCode(email, code, { expiresMinutes: 10 });
    } catch (mailErr) {
      console.error('Failed to send reset code email:', mailErr);
      return res.status(502).json({
        success: false,
        message: 'Unable to send reset code right now. Please try again later.'
      });
    }

    return res.json({
      success: true,
      message: 'A 6-digit reset code has been sent to your email.'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to process forgot password request right now.'
    });
  }
});

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password using email + 6-digit code
 * @access  Public
 */
router.post('/reset-password', resetPasswordValidation, handleValidationErrors, async (req, res) => {
  try {
    const email = String(req.body.email || '').toLowerCase();
    const code = String(req.body.code || '').trim();
    const newPassword = String(req.body.newPassword || '');

    const user = await User.findOne({ email }).select('+password +resetPasswordCodeHash +resetPasswordCodeExpiresAt +resetPasswordCodeAttempts');

    if (!user || !user.isActive || !user.resetPasswordCodeHash || !user.resetPasswordCodeExpiresAt) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset code.'
      });
    }

    if (new Date(user.resetPasswordCodeExpiresAt).getTime() < Date.now()) {
      user.resetPasswordCodeHash = null;
      user.resetPasswordCodeExpiresAt = null;
      user.resetPasswordCodeRequestedAt = null;
      user.resetPasswordCodeAttempts = 0;
      await user.save();

      return res.status(400).json({
        success: false,
        message: 'Reset code expired. Please request a new one.'
      });
    }

    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    if (codeHash !== user.resetPasswordCodeHash) {
      user.resetPasswordCodeAttempts = (user.resetPasswordCodeAttempts || 0) + 1;

      if (user.resetPasswordCodeAttempts >= 5) {
        user.resetPasswordCodeHash = null;
        user.resetPasswordCodeExpiresAt = null;
        user.resetPasswordCodeRequestedAt = null;
        user.resetPasswordCodeAttempts = 0;
      }

      await user.save();
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset code.'
      });
    }

    user.password = newPassword;
    user.refreshTokens = [];
    user.resetPasswordCodeHash = null;
    user.resetPasswordCodeExpiresAt = null;
    user.resetPasswordCodeRequestedAt = null;
    user.resetPasswordCodeAttempts = 0;
    await user.save();

    return res.json({
      success: true,
      message: 'Password has been reset successfully. You can now sign in.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to reset password right now.'
    });
  }
});

/**
 * @route   POST /api/auth/verify-reset-code
 * @desc    Verify that a reset code is valid for an email (no password change)
 * @access  Public
 */
router.post('/verify-reset-code', [
  body('email').isEmail().normalizeEmail(),
  body('code').matches(/^\d{6}$/)
], handleValidationErrors, async (req, res) => {
  try {
    const email = String(req.body.email || '').toLowerCase();
    const code = String(req.body.code || '').trim();

    const user = await User.findOne({ email }).select('+resetPasswordCodeHash +resetPasswordCodeExpiresAt +resetPasswordCodeAttempts');

    if (!user || !user.isActive || !user.resetPasswordCodeHash || !user.resetPasswordCodeExpiresAt) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset code.' });
    }

    if (new Date(user.resetPasswordCodeExpiresAt).getTime() < Date.now()) {
      user.resetPasswordCodeHash = null;
      user.resetPasswordCodeExpiresAt = null;
      user.resetPasswordCodeRequestedAt = null;
      user.resetPasswordCodeAttempts = 0;
      await user.save();

      return res.status(400).json({ success: false, message: 'Reset code expired. Please request a new one.' });
    }

    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    if (codeHash !== user.resetPasswordCodeHash) {
      user.resetPasswordCodeAttempts = (user.resetPasswordCodeAttempts || 0) + 1;

      if (user.resetPasswordCodeAttempts >= 5) {
        user.resetPasswordCodeHash = null;
        user.resetPasswordCodeExpiresAt = null;
        user.resetPasswordCodeRequestedAt = null;
        user.resetPasswordCodeAttempts = 0;
      }

      await user.save();
      return res.status(400).json({ success: false, message: 'Invalid or expired reset code.' });
    }

    // Valid code (do not clear it here - allow single use during reset)
    return res.json({ success: true, message: 'Reset code valid.' });
  } catch (error) {
    console.error('Verify reset code error:', error);
    return res.status(500).json({ success: false, message: 'Unable to verify reset code right now.' });
  }
});

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token required'
      });
    }

    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);

    // Find user and check if refresh token exists
    const user = await User.findById(decoded.id);
    if (!user || !user.refreshTokens.some(rt => rt.token === refreshToken)) {
      return res.status(403).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }

    // Generate new tokens
    const tokens = generateTokenPair(user);

    // Replace old refresh token with new one
    await user.removeRefreshToken(refreshToken);
    const refreshTokenExpiry = new Date();
    refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 7);
    await user.addRefreshToken(tokens.refreshToken, refreshTokenExpiry);

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      tokens
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(403).json({
      success: false,
      message: 'Invalid or expired refresh token'
    });
  }
});

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (invalidate refresh token)
 * @access  Private
 */
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      const user = await User.findById(req.user.id);
      if (user) {
        await user.removeRefreshToken(refreshToken);
      }
    }

    res.json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed'
    });
  }
});

/**
 * @route   GET /api/auth/verify
 * @desc    Verify token and get user info
 * @access  Private
 */
router.get('/verify', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'User not found or inactive'
      });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        bio: user.bio,
        location: user.location,
        website: user.website,
        phoneNumber: user.phoneNumber,
        dateOfBirth: user.dateOfBirth,
        occupation: user.occupation,
        education: user.education,
        interests: user.interests,
        memScore: user.memScore,
        hasCompletedEvaluation: user.hasCompletedEvaluation,
        lastMemScoreUpdate: user.lastMemScoreUpdate,
        preferences: user.preferences,
        profileIconId: user.profileIconId,
        lastLogin: user.lastLogin,
        currentStreak: user.currentStreak,
        longestStreak: user.longestStreak,
        totalStudyDays: user.totalStudyDays
      }
    });

  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Token verification failed'
    });
  }
});

module.exports = router;
