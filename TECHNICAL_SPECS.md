# Memora - Technical Specifications

## 🗄️ MongoDB Database Schemas

### User Collection
```javascript
{
  _id: ObjectId,
  username: String (unique),
  email: String (unique),
  password: String (hashed with bcrypt),
  memScore: Number (0-10),
  preferences: {
    colorTheme: String, // "monochrome", "neon-blue", "neon-green"
    defaultDifficulty: Number (1-5),
    retentionSpeed: String, // "fast", "medium", "slow"
    memScoreRecalibrationFreq: Number // days
  },
  createdAt: Date,
  lastLogin: Date,
  lastMemScoreUpdate: Date
}
```

### Topics Collection
```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  title: String,
  description: String,
  difficulty: Number (1-5),
  tags: [String], // ["Theory", "Coding", "Math"]
  attachments: [{
    type: String, // "pdf", "youtube", "drive", "link"
    url: String,
    title: String
  }],
  reviseBy: Date (optional deadline),
  createdAt: Date,
  lastRevised: Date,
  revisionCount: Number,
  currentInterval: Number, // days until next revision
  nextRevision: Date
}
```

### Revision History Collection
```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  topicId: ObjectId (ref: Topic),
  revisionDate: Date,
  performanceRating: Number (1-5), // user self-assessment
  timeSpent: Number, // minutes
  notes: String,
  scheduledFor: Date, // when it was supposed to be revised
  actualRevision: Date, // when actually revised
  wasOnTime: Boolean
}
```

### Spaced Repetition Schedule Collection
```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  topicId: ObjectId (ref: Topic),
  currentInterval: Number, // current spacing in days
  easeFactor: Number, // SM-2 algorithm ease factor
  repetitions: Number, // number of successful repetitions
  nextReview: Date,
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

---

## 🔌 API Endpoints Structure

### Authentication Routes
```
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/verify
POST /api/auth/refresh
```

### User Routes
```
GET    /api/user/profile
PUT    /api/user/profile
GET    /api/user/memscore
PUT    /api/user/memscore
GET    /api/user/preferences
PUT    /api/user/preferences
DELETE /api/user/account
```

### Topics Routes
```
GET    /api/topics              // get all user topics
POST   /api/topics              // create new topic
GET    /api/topics/:id          // get specific topic
PUT    /api/topics/:id          // update topic
DELETE /api/topics/:id          // delete topic
POST   /api/topics/:id/attachments // add attachment
DELETE /api/topics/:id/attachments/:attachmentId
```

### Revision Routes
```
GET  /api/revisions/today       // today's scheduled revisions
GET  /api/revisions/upcoming    // upcoming revisions
POST /api/revisions/:topicId    // mark topic as revised
GET  /api/revisions/history     // revision history
GET  /api/revisions/analytics   // performance analytics
```

### Neuro Engine Routes
```
POST /api/neuro/calculate-schedule  // calculate next revision
GET  /api/neuro/predictions/:topicId // get revision predictions
PUT  /api/neuro/adjust-schedule     // manual schedule adjustment
GET  /api/neuro/load-balance        // get daily load balance
```

### Calendar Routes
```
GET /api/calendar/month/:year/:month  // get month view
GET /api/calendar/week/:date          // get week view
GET /api/calendar/day/:date           // get day view
```

---

## 🧠 Neuro Engine Algorithm Specifications

### Spaced Repetition Logic (Modified SM-2)
```javascript
// Base intervals for new topics
const baseIntervals = {
  1: 1,    // 1 day
  2: 6,    // 6 days
  3: 16,   // 16 days
  4: 35,   // 35 days
  5: 62    // 62 days
};

// Ease factor calculation based on performance
function calculateEaseFactor(currentEase, performance) {
  // performance: 1-5 scale
  const adjustment = 0.1 - (5 - performance) * (0.08 + (5 - performance) * 0.02);
  return Math.max(1.3, currentEase + adjustment);
}

// Next interval calculation
function calculateNextInterval(repetitions, easeFactor, difficulty, memScore) {
  let interval;
  
  if (repetitions === 0) {
    interval = 1;
  } else if (repetitions === 1) {
    interval = 6;
  } else {
    interval = Math.round(baseIntervals[repetitions - 1] * easeFactor);
  }
  
  // Adjust based on difficulty and memScore
  const difficultyMultiplier = 1 + (difficulty - 3) * 0.2;
  const memScoreMultiplier = memScore / 100;
  
  return Math.round(interval * difficultyMultiplier * memScoreMultiplier);
}
```

### Load Balancing Algorithm
```javascript
function balanceDailyLoad(topics, targetDate) {
  const heavyTopics = topics.filter(t => t.difficulty >= 4);
  const lightTopics = topics.filter(t => t.difficulty <= 2);
  const mediumTopics = topics.filter(t => t.difficulty === 3);
  
  // Max 1 heavy topic per day
  // Max 3 medium topics per day
  // Fill remaining with light topics
  
  return {
    heavy: heavyTopics.slice(0, 1),
    medium: mediumTopics.slice(0, 3),
    light: lightTopics.slice(0, 5)
  };
}
```

---

## 🎨 Component Props Specifications

### TopicCard Component
```typescript
interface TopicCardProps {
  topic: {
    id: string;
    title: string;
    difficulty: number;
    nextRevision: Date;
    reviseBy?: Date;
    tags: string[];
  };
  onRevise: (topicId: string) => void;
  onEdit: (topicId: string) => void;
  variant: 'today' | 'upcoming' | 'overdue';
}
```

### MemScoreBar Component
```typescript
interface MemScoreBarProps {
  score: number; // 0-100
  trend: 'up' | 'down' | 'stable';
  animated: boolean;
  showSparks: boolean;
}
```

### ChronicleDay Component
```typescript
interface ChronicleDayProps {
  date: Date;
  topics: Array<{
    id: string;
    title: string;
    difficulty: number;
    completed: boolean;
  }>;
  onTopicClick: (topicId: string) => void;
  onAddTopic: (date: Date) => void;
}
```

---

## 🔐 Security Specifications

### JWT Configuration
- **Secret:** Environment variable
- **Expiration:** 24 hours for access token
- **Refresh Token:** 7 days
- **Algorithm:** HS256

### Password Security
- **Hashing:** bcrypt with salt rounds: 12
- **Minimum Length:** 8 characters
- **Requirements:** At least one uppercase, lowercase, number

### API Security
- **Rate Limiting:** 100 requests per 15 minutes per IP
- **CORS:** Configured for production domains only
- **Input Validation:** Joi schema validation
- **SQL Injection Prevention:** MongoDB parameterized queries
