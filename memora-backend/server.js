const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// Security middleware
app.use(helmet());

// Rate limiting - Disabled for development
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 100, // limit each IP to 100 requests per windowMs
//   message: 'Too many requests from this IP, please try again later.'
// });
// app.use(limiter);

// CORS configuration: allow local dev hosts on any port + optional explicit frontend URL.
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'https://lwj6kt2m-5173.inc1.devtunnels.ms'
].filter(Boolean);

const isLocalDevOrigin = (origin) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (no Origin header) and local dev ports.
    if (!origin || isLocalDevOrigin(origin) || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

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
