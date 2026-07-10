# MEMORA - TECHNICAL MANUAL FOR AI AGENTS

## PROJECT OVERVIEW

**Memora** is a sophisticated full-stack spaced repetition learning platform that combines cognitive assessment, intelligent scheduling algorithms, and modern web technologies. The system is designed to optimize memory retention through scientifically-backed spaced repetition techniques and personalized cognitive evaluation.

### Core Architecture
- **Frontend**: React 19.1.0 + Vite 7.0.4 + Tailwind CSS 4.1.11
- **Backend**: Node.js + Express.js 4.18.2 + MongoDB + Mongoose ODM
- **Authentication**: JWT with bcrypt password hashing
- **UI Framework**: Framer Motion 12.23.6 for animations
- **Design System**: Cyber-grid aesthetic with dark theme and neon accents

## SYSTEM COMPONENTS

### 1. FRONTEND ARCHITECTURE (`memora-frontend/`)

#### 1.1 Application Structure
```
src/
├── components/          # Reusable UI components
├── pages/              # Main application pages
├── contexts/           # React context providers
├── hooks/              # Custom React hooks
├── services/           # API service layer
└── assets/             # Static assets
```

#### 1.2 Key Components

**App.jsx** - Main application router with the following routes:
- `/` - Landing page
- `/login` - User authentication
- `/signup` - User registration
- `/evaluation` - MemScore cognitive assessment
- `/dashboard` - Main user interface
- `/topics` - Topic management
- `/doctags` - Document attachment system
- `/journal` - Learning journal
- `/focus` - Focus mode for studying
- `/profile` - User profile management

**CyberGrid.jsx** - Interactive background component with mouse-tracking radial gradients and animated nodes for the cyber-aesthetic design.

**AuthContext.jsx** - Global authentication state management with user session handling, token management, and automatic token refresh.

**TimerContext.jsx** - Global timer state for focus sessions and study tracking.

#### 1.3 API Service Layer (`services/api.js`)

**ApiService Class** - Centralized API communication with:
- Automatic token management
- Request/response logging
- Error handling with network detection
- Token refresh mechanism
- User-specific localStorage cleanup

**Key Methods**:
- Authentication: `register()`, `login()`, `logout()`, `verifyToken()`, `refreshToken()`
- User Management: `getUserProfile()`, `updateUserProfile()`, `saveEvaluationResults()`
- Topics: `getTopics()`, `createTopic()`, `updateTopic()`, `deleteTopic()`, `reviewTopic()`
- Spaced Repetition: `getDueTopics()`, `getUpcomingTopics()`, `preventCrowding()`

### 2. BACKEND ARCHITECTURE (`memora-backend/`)

#### 2.1 Server Configuration (`server.js`)
- **Security**: Helmet.js for security headers, CORS configuration
- **Rate Limiting**: Configurable (disabled in development)
- **Body Parsing**: JSON with 10MB limit
- **MongoDB Connection**: Non-blocking with graceful fallback
- **Error Handling**: Comprehensive middleware with environment-aware responses

#### 2.2 Database Models

**User Model** (`models/User.js`):
```javascript
{
  username: String (unique, 3-30 chars, alphanumeric + underscore),
  email: String (unique, validated),
  password: String (bcrypt hashed, 12 salt rounds),
  memScore: Number (0-100),
  hasCompletedEvaluation: Boolean,
  evaluationResults: {
    memoryGame: Number,
    tileRecall: Number,
    processingSpeed: Number,
    overallScore: Number,
    completedAt: Date
  },
  preferences: {
    colorTheme: String, // "monochrome", "neon-blue", "neon-green"
    defaultDifficulty: Number (1-5),
    retentionSpeed: String, // "fast", "medium", "slow"
    memScoreRecalibrationFreq: Number // days
  },
  currentStreak: Number,
  longestStreak: Number,
  totalStudyDays: Number,
  lastStudyDate: Date,
  refreshTokens: [{ token: String, expiresAt: Date }]
}
```

**Topic Model** (`models/Topic.js`):
```javascript
{
  title: String (max 200 chars),
  content: String (max 10000 chars),
  userId: ObjectId (ref: User),
  difficulty: Number (1-5),
  category: String, // "Science", "Mathematics", etc.
  tags: [String],
  
  // Spaced Repetition Fields
  easeFactor: Number (default: 2.5, min: 1.3),
  interval: Number (days, default: 1),
  repetitions: Number (default: 0),
  nextReviewDate: Date,
  isLearning: Boolean (default: true),
  
  // Performance Tracking
  reviewCount: Number,
  averagePerformance: Number (0-1),
  lastReviewed: Date,
  
  // Attachments & Links
  attachments: [{ filename, originalName, mimetype, size, url }],
  externalLinks: [{ title, url, type, description }]
}
```

#### 2.3 Authentication System (`routes/auth.js`)

**Security Features**:
- Password validation: minimum 8 chars, uppercase, lowercase, number
- Username validation: 3-30 chars, alphanumeric + underscore only
- Email normalization and validation
- JWT access tokens (15 minutes) + refresh tokens (7 days)
- Automatic token rotation on refresh
- Maximum 5 refresh tokens per user

**Endpoints**:
- `POST /api/auth/register` - User registration with validation
- `POST /api/auth/login` - User authentication
- `POST /api/auth/logout` - Token invalidation
- `POST /api/auth/refresh` - Token refresh
- `GET /api/auth/verify` - Token verification

## 3. COGNITIVE ASSESSMENT SYSTEM (MemScore)

### 3.1 Memory Game Assessment
**Implementation**: Card matching game with emoji pairs
- **Grid Size**: 4x4 (16 cards, 8 pairs)
- **Preview Phase**: 10-second preview showing all card positions
- **Scoring Algorithm**: `score = max(0, 10 - wrongAttempts)`
- **Emojis Used**: ['🎯', '🎮', '🎨', '🎭', '🎪', '🎸', '🎺', '🎻', '🎹', '🎲', '🎳', '🚀', '🛸', '🌟', '⭐', '🌙', '☀️']

### 3.2 Tile Recall Test
**Implementation**: Progressive spatial memory test
- **Rounds**: 5 rounds with increasing difficulty
- **Sequence Lengths**: 3 → 5 → 7 → 9 → 11 tiles
- **Grid Size**: 5x5 grid (25 tiles)
- **Show Time**: Decreasing per round (2000ms → 1500ms → 1200ms → 1000ms → 800ms)
- **Scoring**: 2 points per correct round, -0.5 penalty per mistake
- **Maximum Score**: 10 points

### 3.3 Processing Speed Test
**Implementation**: Rapid math challenge
- **Duration**: 30 seconds
- **Question Types**: Addition, subtraction, multiplication
- **Number Range**: 1-20 for operands
- **Input Method**: Auto-focus text input with Enter key submission
- **Scoring Formula**: `(correctAnswers / totalQuestions) × 10`

### 3.4 MemScore Calculation
**Overall Score**: Average of all three test scores, displayed as integer (0-100)
```javascript
overallScore = Math.round((memoryGameScore + tileRecallScore + processingSpeedScore) / 3)
```

## 4. SPACED REPETITION ALGORITHM

### 4.1 SM-2 Based Implementation
**Enhanced SuperMemo SM-2 Algorithm**:

```javascript
// Quality ratings: 0-5 scale (0 = complete blackout, 5 = perfect response)
function updateSpacedRepetition(quality) {
  this.reviewCount += 1;
  this.lastReviewed = new Date();
  
  if (quality < 3) {
    // Reset learning for poor performance
    this.repetitions = 0;
    this.interval = 1;
    this.isLearning = true;
  } else {
    // Update ease factor based on quality
    this.easeFactor = Math.max(1.3, 
      this.easeFactor + (0.1 - (5-quality) * (0.08 + (5-quality) * 0.02))
    );
    
    // Calculate next interval
    if (this.repetitions === 0) this.interval = 1;
    else if (this.repetitions === 1) this.interval = 6;
    else this.interval = Math.round(this.interval * this.easeFactor);
    
    this.repetitions += 1;
    
    // Mark as learned after successful repetitions
    if (this.repetitions >= 3 && quality >= 4) {
      this.isLearning = false;
    }
  }
  
  // Set next review date
  this.nextReviewDate = new Date(Date.now() + this.interval * 24 * 60 * 60 * 1000);
  
  // Update average performance
  const totalPerformance = (this.averagePerformance * (this.reviewCount - 1)) + (quality / 5);
  this.averagePerformance = totalPerformance / this.reviewCount;
}
```

### 4.2 Crowding Prevention System
**Difficulty-Based Load Balancing**:

**Thresholds** (adjusted by average difficulty):
```javascript
const baseThresholds = {
  light: 2,    // 1-2 topics
  medium: 3,   // 3 topics  
  heavy: 4,    // 4 topics
  crowded: 5   // 5+ topics (requires redistribution)
};

const difficultyMultipliers = {
  1: 1.4,   // Easy: can handle 40% more
  2: 1.2,   // Below Medium: can handle 20% more
  3: 1.0,   // Medium: base thresholds
  4: 0.8,   // Hard: reduce by 20%
  5: 0.6    // Expert: reduce by 40%
};
```

**Redistribution Logic**:
1. Analyze daily topic counts with difficulty weighting
2. Identify crowded days (exceeding thresholds)
3. Prioritize moving higher difficulty topics first
4. Find alternative dates within ±3 to +7 day range
5. Update `nextReviewDate` and increment `rescheduleCount`

## 5. API ENDPOINTS

### 5.1 Authentication Routes (`/api/auth/`)
- `POST /register` - User registration
- `POST /login` - User authentication  
- `POST /logout` - Session termination
- `POST /refresh` - Token refresh
- `GET /verify` - Token validation

### 5.2 User Routes (`/api/user/`)
- `GET /profile` - Get user profile
- `PUT /profile` - Update user profile
- `POST /evaluation` - Save MemScore results
- `GET /memscore` - Get current MemScore
- `POST /study-session` - Record study session

### 5.3 Topics Routes (`/api/topics/`)
- `GET /` - Get user topics (with filtering)
- `POST /` - Create new topic
- `GET /due` - Get topics due for review
- `GET /upcoming` - Get upcoming review schedule
- `POST /:id/review` - Submit topic review
- `PUT /:id` - Update topic
- `DELETE /:id` - Delete topic
- `POST /prevent-crowding` - Redistribute crowded topics
- `GET /workload` - Get workload analysis

## 6. DESIGN SYSTEM

### 6.1 Cyber-Grid Aesthetic
**Color Palette**:
- Background: `#000000` (pure black)
- Primary Text: `#ffffff` (white)
- Secondary Text: `#a1a1aa` (zinc-400)
- Accent Blue: `#00d4ff` (cyber-blue)
- Accent Green: `#00ff88` (cyber-green)
- Grid Lines: `#1f2937` (gray-800)

**Typography**:
- Font Family: System fonts (Inter, SF Pro, Segoe UI)
- Headings: Bold, uppercase for technical feel
- Body: Regular weight, high contrast

**Components**:
- No rounded corners (sharp, geometric design)
- Subtle animations with Framer Motion
- Grid-based layouts
- Terminal-inspired interfaces
- No scrollbars (perfect viewport fit)

### 6.2 Responsive Design
**Breakpoints**:
- Mobile: `< 768px`
- Tablet: `768px - 1024px`  
- Desktop: `> 1024px`

**Mobile Adaptations**:
- Collapsible sidebar navigation
- Touch-optimized button sizes
- Simplified grid layouts
- Reduced animation complexity

## 7. STATE MANAGEMENT

### 7.1 Authentication Context
**AuthContext** manages:
- User session state
- Token storage and refresh
- Login/logout operations
- Evaluation results
- User preferences

### 7.2 Timer Context
**TimerContext** manages:
- Focus session timers
- Study session tracking
- Break reminders
- Session statistics

### 7.3 Local Storage Usage
**User-Specific Data**:
- `accessToken` - JWT access token
- `refreshToken` - JWT refresh token
- `currentUser` - User profile cache
- `sidebarCollapsed` - UI preference
- `focusModeSettings_{userId}` - Focus mode preferences
- `focusModePresets_{userId}` - Custom focus presets

## 8. SECURITY IMPLEMENTATION

### 8.1 Password Security
- **Hashing**: bcrypt with 12 salt rounds
- **Validation**: Minimum 8 chars, mixed case, numbers required
- **Storage**: Never stored in plain text, excluded from queries by default

### 8.2 JWT Token System
- **Access Tokens**: 15-minute expiry, contains user ID and basic info
- **Refresh Tokens**: 7-day expiry, stored in database with expiration tracking
- **Rotation**: New refresh token issued on each refresh request
- **Cleanup**: Automatic removal of expired tokens

### 8.3 Input Validation
- **express-validator**: Server-side validation for all inputs
- **Mongoose Schemas**: Database-level validation and constraints
- **XSS Protection**: Helmet.js security headers
- **CORS**: Restricted to specific origins

## 9. PERFORMANCE OPTIMIZATIONS

### 9.1 Database Indexing
**User Collection**:
- `{ email: 1 }` - Login queries
- `{ username: 1 }` - Username lookups
- `{ createdAt: -1 }` - Chronological sorting

**Topic Collection**:
- `{ userId: 1, createdAt: -1 }` - User topic lists
- `{ userId: 1, nextReviewDate: 1 }` - Due topic queries
- `{ userId: 1, isActive: 1 }` - Active topic filtering
- `{ title: 'text', content: 'text' }` - Full-text search

### 9.2 Frontend Optimizations
- **Code Splitting**: Route-based lazy loading
- **Asset Optimization**: Vite build optimization
- **Animation Performance**: 60fps Framer Motion animations
- **Memory Management**: Automatic cleanup of user data on logout

## 10. ERROR HANDLING

### 10.1 Backend Error Handling
- **Validation Errors**: Structured error responses with field-specific messages
- **Database Errors**: Graceful handling with user-friendly messages
- **Authentication Errors**: Specific error codes for different auth failures
- **Network Errors**: Timeout and connection error handling

### 10.2 Frontend Error Handling
- **API Errors**: Automatic retry for network failures
- **Token Expiry**: Automatic refresh with fallback to login
- **Form Validation**: Real-time validation with error display
- **Fallback UI**: Error boundaries for component failures

## 11. DEVELOPMENT WORKFLOW

### 11.1 Environment Setup
**Prerequisites**:
- Node.js 16+
- MongoDB (local or Atlas)
- Modern browser (Chrome, Firefox, Safari, Edge)

**Development Commands**:
```bash
# Backend
cd memora-backend
npm install
npm run dev  # Starts on port 3001

# Frontend
cd memora-frontend
npm install
npm run dev  # Starts on port 5173
```

### 11.2 Environment Variables
**Backend (.env)**:
```env
PORT=3001
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/memora
JWT_SECRET=your-jwt-secret
JWT_REFRESH_SECRET=your-refresh-secret
FRONTEND_URL=http://localhost:5173
BCRYPT_SALT_ROUNDS=12
```

## 12. TESTING CONSIDERATIONS

### 12.1 Unit Testing Areas
- **Spaced Repetition Algorithm**: Test interval calculations and ease factor updates
- **MemScore Calculations**: Verify scoring algorithms for all three tests
- **Authentication**: Test token generation, validation, and refresh
- **API Endpoints**: Test all CRUD operations and error cases
- **Crowding Prevention**: Test redistribution logic and threshold calculations

### 12.2 Integration Testing
- **Authentication Flow**: Complete login/logout/refresh cycle
- **Topic Lifecycle**: Create → Review → Update → Delete
- **Evaluation Process**: Complete MemScore assessment flow
- **Database Operations**: Test all model methods and static functions

## 13. DEPLOYMENT CONSIDERATIONS

### 13.1 Production Configuration
- **Environment Variables**: Secure JWT secrets, production MongoDB URI
- **Rate Limiting**: Enable API rate limiting
- **CORS**: Restrict to production domain only
- **HTTPS**: SSL/TLS encryption required
- **Database**: MongoDB Atlas or dedicated MongoDB instance

### 13.2 Performance Monitoring
- **Database Queries**: Monitor slow queries and optimize indexes
- **API Response Times**: Track endpoint performance
- **Memory Usage**: Monitor for memory leaks in long-running sessions
- **Error Rates**: Track and alert on error frequency

## 14. FUTURE ENHANCEMENTS

### 14.1 Planned Features
- **ReviseBy**: Deadline management system for exam preparation
- **Chronicle**: Calendar view for review scheduling and planning
- **DocTags**: Enhanced attachment system with PDF, YouTube, Drive integration
- **Difficulty Matrix**: Smart topic load balancing across difficulty levels
- **Performance Analytics**: Advanced progress tracking and insights

### 14.2 Technical Improvements
- **Testing Suite**: Comprehensive unit and integration tests
- **Performance Optimization**: Query optimization and caching
- **Security Enhancements**: Additional security headers and validation
- **Mobile App**: React Native mobile application
- **Offline Support**: Service worker for offline functionality

---

This technical manual provides comprehensive information for AI agents to understand, maintain, and extend the Memora platform. All code examples, algorithms, and configurations are based on the actual implementation in the codebase.
