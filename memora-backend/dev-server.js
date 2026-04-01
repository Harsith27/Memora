const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// CORS configuration
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// MongoDB connection (optional for development)
const connectDB = async () => {
  try {
    const conn = await mongoose.connect('mongodb://localhost:27017/memora');
    console.info(`MongoDB connected: ${conn.connection.host}`);
    return true;
  } catch (error) {
    console.warn('⚠️  MongoDB connection failed. Running in development mode without database.');
    console.warn('To use full functionality, please start MongoDB or provide a valid MONGODB_URI');
    return false;
  }
};

// Connect to database (non-blocking for development)
let dbConnected = false;
connectDB().then(connected => {
  dbConnected = connected;
});

// Health check route
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Memora Backend API is running',
    timestamp: new Date().toISOString(),
    port: 8080,
    database: dbConnected ? 'connected' : 'disconnected'
  });
});

// Mock authentication routes for development
app.post('/api/auth/register', (req, res) => {
  // Simulate validation
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Username, email, and password are required'
    });
  }

  // Simulate successful registration
  res.status(201).json({ 
    success: true, 
    message: 'User registered successfully',
    user: { 
      id: Date.now(), 
      email: email.toLowerCase(), 
      username: username,
      memScore: 0,
      hasCompletedEvaluation: false,
      preferences: {
        colorTheme: 'monochrome',
        defaultDifficulty: 3,
        retentionSpeed: 'medium'
      }
    },
    tokens: {
      accessToken: 'mock-jwt-access-token-' + Date.now(),
      refreshToken: 'mock-jwt-refresh-token-' + Date.now()
    }
  });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email and password are required'
    });
  }

  // Use default memScore for all users (0-10 scale)
  const memScore = 7.0;

  // Simulate successful login
  res.json({
    success: true,
    message: 'Login successful',
    user: {
      id: 'harsith',
      email: email.toLowerCase(),
      username: 'Harsith',
      memScore: memScore,
      hasCompletedEvaluation: true,
      currentStreak: 0,
      longestStreak: 0,
      totalStudyDays: 0,
      preferences: {
        colorTheme: 'monochrome',
        defaultDifficulty: 3,
        retentionSpeed: 'medium'
      },
      lastLogin: new Date().toISOString()
    },
    tokens: {
      accessToken: 'mock-jwt-access-token-' + Date.now(),
      refreshToken: 'mock-jwt-refresh-token-' + Date.now()
    }
  });
});

app.post('/api/auth/logout', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Logged out successfully'
  });
});

app.get('/api/auth/verify', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token required'
    });
  }

  // Mock token verification response
  const email = 'demo@memora.local';
  const memScore = 7.0;

  res.json({
    success: true,
    user: {
      id: 'harsith',
      username: 'Harsith',
      email: email,
      memScore: memScore,
      hasCompletedEvaluation: true,
      currentStreak: 0,
      longestStreak: 0,
      totalStudyDays: 0,
      preferences: {
        colorTheme: 'monochrome',
        defaultDifficulty: 3,
        retentionSpeed: 'medium'
      }
    }
  });
});

// Mock evaluation results endpoint
app.post('/api/user/evaluation', (req, res) => {
  const { memoryGame, tileRecall, processingSpeed, overallScore } = req.body;

  res.json({
    success: true,
    message: 'Evaluation results saved successfully',
    results: {
      memoryGame,
      tileRecall,
      processingSpeed,
      overallScore,
      completedAt: new Date().toISOString()
    }
  });
});

// Mock topics storage
let mockTopics = [];
let topicIdCounter = 1;

// Mock topics endpoints
app.get('/api/topics', (req, res) => {
  setTimeout(() => {
    res.json({
      success: true,
      topics: mockTopics,
      count: mockTopics.length
    });
  }, 500); // Reduced delay from 10 seconds to 0.5 seconds
});

app.get('/api/topics/due', (req, res) => {
  const dueTopics = mockTopics.filter(topic => new Date(topic.nextReviewDate) <= new Date());
  res.json({
    success: true,
    topics: dueTopics,
    count: dueTopics.length
  });
});

app.get('/api/topics/upcoming', (req, res) => {
  const upcomingTopics = mockTopics.filter(topic => new Date(topic.nextReviewDate) > new Date());
  res.json({
    success: true,
    topics: upcomingTopics,
    count: upcomingTopics.length
  });
});

app.post('/api/topics', (req, res) => {
  const { title, content, difficulty = 3 } = req.body;

  const newTopic = {
    _id: `topic_${topicIdCounter++}`,
    title,
    content,
    difficulty,
    userId: 'mock_user_id',
    createdAt: new Date().toISOString(),
    nextReviewDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
    interval: 1,
    repetitions: 0,
    easeFactor: 2.5,
    isActive: true
  };

  mockTopics.push(newTopic);

  setTimeout(() => {
    res.json({
      success: true,
      message: 'Topic created successfully',
      topic: newTopic
    });
  }, 200); // Fast response
});

app.post('/api/topics/:id/review', (req, res) => {
  const { quality } = req.body;
  const topicId = req.params.id;

  const topic = mockTopics.find(t => t._id === topicId);
  if (!topic) {
    return res.status(404).json({
      success: false,
      message: 'Topic not found'
    });
  }

  // Simple spaced repetition logic
  if (quality === 0) {
    // Skip - postpone by 1 day
    topic.nextReviewDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  } else {
    // Mark done - calculate next interval
    topic.repetitions += 1;
    if (topic.repetitions === 1) {
      topic.interval = 1;
    } else if (topic.repetitions === 2) {
      topic.interval = 6;
    } else {
      topic.interval = Math.round(topic.interval * topic.easeFactor);
    }
    topic.nextReviewDate = new Date(Date.now() + topic.interval * 24 * 60 * 60 * 1000).toISOString();
  }

  res.json({
    success: true,
    message: 'Review recorded successfully',
    topic: {
      id: topic._id,
      nextReviewDate: topic.nextReviewDate,
      interval: topic.interval,
      repetitions: topic.repetitions
    }
  });
});

app.delete('/api/topics/:id', (req, res) => {
  const topicId = req.params.id;

  const index = mockTopics.findIndex(t => t._id === topicId);
  if (index === -1) {
    return res.status(404).json({
      success: false,
      message: 'Topic not found'
    });
  }

  mockTopics.splice(index, 1);

  res.json({
    success: true,
    message: 'Topic deleted successfully'
  });
});

// Mock study session endpoint
app.post('/api/user/study-session', (req, res) => {
  res.json({
    success: true,
    message: 'Study session recorded',
    currentStreak: 1,
    longestStreak: 1,
    totalStudyDays: 1
  });
});

// Load API routes - Commented out for dev-server, using mock endpoints instead
// try {
//   console.log('🔄 Loading API routes...');
//   app.use('/api/auth', require('./routes/auth'));
//   console.log('✅ Auth routes loaded');
//   app.use('/api/user', require('./routes/user'));
//   console.log('✅ User routes loaded');
//   app.use('/api/topics', require('./routes/topics'));
//   console.log('✅ Topics routes loaded');
//   console.log('✅ All API routes loaded successfully');
// } catch (error) {
//   console.error('❌ Error loading API routes:', error);
//   console.warn('⚠️  Some routes may not be available');
// }

console.info('Using mock API endpoints for development');

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

const PORT = 3001;

app.listen(PORT, () => {
  console.info(`Memora dev server running on port ${PORT}`);
});

module.exports = app;
