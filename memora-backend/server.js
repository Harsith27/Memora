const express = require('express');
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (e) {
  console.warn('Could not set custom DNS servers:', e.message);
}
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
    ...parseCsvOrigins(process.env.EXTRA_ALLOWED_ORIGINS)
  ])
];
const allowVercelPreviews = toBoolean(process.env.ALLOW_VERCEL_PREVIEWS, true);
const allowLocalOrigins = !isProduction || toBoolean(process.env.ALLOW_LOCALHOST_CORS, false);

const isVercelPreviewOrigin = (origin) => /^https:\/\/(?:[a-z0-9-]+\.)*[a-z0-9-]+\.vercel\.app$/i.test(origin);
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

  app.use('/api', (req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
      return next();
    }

    return limiter(req, res, next);
  });
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
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/memora', {
      family: 4
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    // Run background classification migration for existing legacy tasks
    migrateExistingTasks();
  } catch (error) {
    console.error('❌ Mongoose connection error details:', error);
    console.warn('⚠️  MongoDB connection failed. Running in development mode without database.');
    console.warn('To use full functionality, please start MongoDB or provide a valid MONGODB_URI');
  }
};

const migrateExistingTasks = async () => {
  try {
    const Task = require('./models/Task');
    const { fetchGroq } = require('./utils/groq');

    console.log('[Migration] Starting task classification migration...');
    const tasks = await Task.find({
      $or: [
        { completionType: { $exists: false } },
        { completionType: 'boolean', targetValue: 1 }
      ]
    }).lean();

    if (tasks.length === 0) {
      console.log('[Migration] No default tasks need classification.');
      return;
    }

    console.log(`[Migration] Found ${tasks.length} default tasks/habits to analyze.`);
    const processedSeriesIds = new Set();
    const systemPrompt = `You are a helper that classifies user study tasks and habits into one of four metric tracking types:
- 'boolean' (tasks that are simple yes/no checkmarks, e.g., "Check email", "Buy milk", "Submit form", "Call mom")
- 'quantity' (tasks that specify a target numerical quantity, e.g., "Do 50 pushups", "Solve 5 math problems", "Eat 2 eggs", "Read 10 pages")
- 'percent' (tasks that imply progress tracking, completion, or reading/study drafts where percentage-based progress is desired, e.g., "Complete Fabric Concept", "Finish writing project draft", "Work on physics essay", "Complete 80% of project draft", "Review 100% of biology cards")
- 'time' (tasks that specify a duration in minutes or hours, e.g., "Study Physics for 60 mins", "Revise React for 2 hrs", "Code for 1 hour")

Return ONLY a valid JSON object with keys "completionType" and "targetValue".
For 'boolean', targetValue should be 1.
For 'quantity', targetValue is the numerical quantity target (e.g. 50, 5, etc).
For 'percent', targetValue is the percentage target (e.g. 100, 80, etc). If not specified, default to 100.
For 'time', targetValue is the duration normalized into minutes (e.g., 60 for "60 mins", 120 for "2 hrs", 60 for "1 hour").
Do not include any explanation or markdown formatting in your response. Return ONLY the raw JSON object.`;

    for (const task of tasks) {
      if (task.seriesId && processedSeriesIds.has(task.seriesId)) {
        continue;
      }

      const titleVal = String(task.title || '').trim();
      if (!titleVal || titleVal.length < 3) continue;

      console.log(`[Migration] Analyzing: "${titleVal}"`);
      let classification = { completionType: 'boolean', targetValue: 1 };

      try {
        const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
        const response = await fetchGroq('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            temperature: 0.1,
            max_tokens: 150,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: `Title: "${titleVal}"` }
            ]
          })
        });

        if (response.ok) {
          const data = await response.json();
          const parsed = JSON.parse((data?.choices?.[0]?.message?.content || '').trim());
          if (['boolean', 'quantity', 'percent', 'time'].includes(parsed.completionType)) {
            classification = {
              completionType: parsed.completionType,
              targetValue: Math.max(1, Number(parsed.targetValue) || 1)
            };
          }
        }
      } catch (e) {
        console.warn(`[Migration] Failed to classify "${titleVal}":`, e.message);
        continue;
      }

      if (classification.completionType !== 'boolean' || classification.targetValue !== 1) {
        if (task.seriesId) {
          console.log(`[Migration] Applying ${classification.completionType} (${classification.targetValue}) to series: ${task.seriesId}`);
          await Task.updateMany(
            { seriesId: task.seriesId },
            {
              $set: {
                completionType: classification.completionType,
                targetValue: classification.targetValue
              }
            }
          );
          processedSeriesIds.add(task.seriesId);
        } else {
          console.log(`[Migration] Applying ${classification.completionType} (${classification.targetValue}) to task: ${task.clientId}`);
          await Task.updateOne(
            { _id: task._id },
            {
              $set: {
                completionType: classification.completionType,
                targetValue: classification.targetValue
              }
            }
          );
        }
      } else {
        await Task.updateOne(
          { _id: task._id },
          { $set: { completionType: 'boolean', targetValue: 1 } }
        );
        if (task.seriesId) {
          processedSeriesIds.add(task.seriesId);
        }
      }
    }
    console.log('[Migration] All legacy tasks processed successfully.');
  } catch (err) {
    console.error('[Migration] Failed:', err);
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
      tasks: '/api/tasks/*',
      doctags: '/api/doctags/*',
      journal: '/api/journal/*',
      mindmaps: '/api/mindmaps/*',
      listener: '/api/listener/*'
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
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/doctags', require('./routes/doctags'));
app.use('/api/journal', require('./routes/journal'));
app.use('/api/mindmaps', require('./routes/mindmaps'));
app.use('/api/listener', require('./routes/listener'));
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
