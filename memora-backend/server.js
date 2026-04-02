const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

const toBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(normalized);
};

const parseCsvOrigins = (value) => String(value || '')
  .split(',')
  .map((item) => item.trim().replace(/\/+$/, ''))
  .filter(Boolean);

const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const isProduction = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
const explicitAllowedOrigins = [
  ...new Set([
    ...parseCsvOrigins(process.env.FRONTEND_URL),
    ...parseCsvOrigins(process.env.FRONTEND_URLS),
    'https://lwj6kt2m-5173.inc1.devtunnels.ms'
  ])
];
const allowVercelPreviews = toBoolean(process.env.ALLOW_VERCEL_PREVIEWS, true);
const allowLocalOrigins = !isProduction || toBoolean(process.env.ALLOW_LOCALHOST_CORS, false);

const isVercelPreviewOrigin = (origin) => /^https:\/\/[a-z0-9-]+(?:-[a-z0-9-]+)*\.vercel\.app$/i.test(origin);
const isLocalDevOrigin = (origin) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);

// Security middleware
app.use(helmet());

if (isProduction) {
  app.set('trust proxy', 1);
}

const enableRateLimit = isProduction || toBoolean(process.env.ENABLE_RATE_LIMIT, false);
if (enableRateLimit) {
  const limiter = rateLimit({
    windowMs: parsePositiveInt(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    max: parsePositiveInt(process.env.RATE_LIMIT_MAX_REQUESTS, 100),
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests from this IP, please try again later.'
  });

  app.use(limiter);
}

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      // Allow non-browser requests and same-origin server-to-server traffic.
      return callback(null, true);
    }

    const normalizedOrigin = String(origin).trim().replace(/\/+$/, '');
    const isExplicitlyAllowed = explicitAllowedOrigins.includes(normalizedOrigin);
    const isLocalAllowed = allowLocalOrigins && isLocalDevOrigin(normalizedOrigin);
    const isVercelAllowed = allowVercelPreviews && isVercelPreviewOrigin(normalizedOrigin);

    if (isExplicitlyAllowed || isLocalAllowed || isVercelAllowed) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked for origin: ${normalizedOrigin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files.
// Upload previews are opened inside the frontend iframe, so we relax frame/CORP headers
// only for this static route while keeping helmet defaults for API responses.
app.use('/uploads', (req, res, next) => {
  res.removeHeader('X-Frame-Options');
  res.removeHeader('Content-Security-Policy');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static('uploads'));

// MongoDB connection
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/memora');
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.warn('⚠️  MongoDB connection failed. Running in development mode without database.');
    console.warn('To use full functionality, please start MongoDB or provide a valid MONGODB_URI');
  }
};

// Connect to database (non-blocking for development)
connectDB();



// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'Memora Backend API',
    status: 'running',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth/*',
      user: '/api/user/*',
      topics: '/api/topics/*',
      doctags: '/api/doctags/*',
      journal: '/api/journal/*',
      mindmaps: '/api/mindmaps/*'
    }
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Memora Backend API is running',
    timestamp: new Date().toISOString()
  });
});

// Import route modules
app.use('/api/auth', require('./routes/auth'));
app.use('/api/user', require('./routes/user'));
app.use('/api/topics', require('./routes/topics'));
app.use('/api/doctags', require('./routes/doctags'));
app.use('/api/journal', require('./routes/journal'));
app.use('/api/mindmaps', require('./routes/mindmaps'));
// app.use('/api/revisions', require('./routes/revisions'));
// app.use('/api/neuro', require('./routes/neuro'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🚀 Memora Backend Server running on port ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
