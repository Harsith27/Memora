# Memora - Advanced Spaced Repetition Learning Platform

> **"Sets Your Memory in Motion"**

Memora is a sophisticated full-stack learning platform that combines cognitive assessment, spaced repetition algorithms, and intelligent scheduling to optimize memory retention. Built with modern technologies and featuring a sleek cyber-grid aesthetic, Memora transforms how users approach learning and memory training.

## 🧠 Core Features

### 🎯 Cognitive Assessment System (MemScore)
- **Memory Game**: Card matching with 10-second preview and emoji-based challenges
- **Tile Recall**: Progressive spatial memory test with 5 rounds (3→5→7→9→11 tiles)
- **Processing Speed**: 30-second rapid math challenge with auto-focus input
- **Intelligent Scoring**: Advanced algorithms that generate personalized MemScore (0-10)
- **Performance Analytics**: Detailed breakdown of cognitive strengths and areas for improvement

### 📚 Spaced Repetition System
- **Smart Scheduling**: AI-powered algorithm that optimizes review intervals
- **Topic Management**: Create, organize, and track learning materials
- **Difficulty Scaling**: 5-level difficulty system with adaptive scheduling
- **Performance Tracking**: Monitor retention rates and learning progress
- **Review Queue**: Intelligent daily review recommendations

### 👤 User Management & Authentication
- **Secure Authentication**: JWT-based auth with refresh token rotation
- **User Profiles**: Comprehensive user data with preferences and settings
- **Study Streaks**: Track daily learning habits and maintain motivation
- **Progress Analytics**: Detailed insights into learning patterns and performance

### 🎨 Modern Interface Design
- **Cyber-Grid Aesthetic**: Dark theme with neon accents inspired by Vercel.com
- **Responsive Design**: Optimized for desktop and mobile devices
- **Smooth Animations**: Framer Motion powered transitions and interactions
- **No Scrollbars**: Perfect viewport fit for distraction-free learning
- **Professional UI**: Clean, technical interface with geometric precision

## 🏗️ Architecture

### Full-Stack Technology Stack
- **Frontend**: React 19.1.0 + Vite 7.0.4 + Tailwind CSS 4.1.11
- **Backend**: Node.js + Express.js 4.18.2
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT with bcrypt password hashing
- **Animations**: Framer Motion 12.23.6
- **State Management**: React Context API
- **API Communication**: Custom ApiService with fetch

### Project Structure
```
Memora/
├── memora-frontend/          # React frontend application
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   ├── pages/           # Main application pages
│   │   ├── contexts/        # React context providers
│   │   ├── hooks/           # Custom React hooks
│   │   ├── services/        # API service layer
│   │   └── assets/          # Static assets
│   └── package.json
├── memora-backend/          # Node.js backend API
│   ├── models/              # MongoDB schemas
│   ├── routes/              # API route handlers
│   ├── middleware/          # Express middleware
│   ├── utils/               # Utility functions
│   └── server.js            # Main server file
└── README.md
```

## 🚀 Getting Started

### Prerequisites
- **Node.js** (version 16 or higher)
- **MongoDB** (local installation or MongoDB Atlas)
- **npm** or **yarn** package manager
- Modern web browser (Chrome, Firefox, Safari, Edge)

### Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Memora
   ```

2. **Backend Setup**
   ```bash
   cd memora-backend
   npm install
   npm run dev
   ```
   Backend will start on `http://localhost:3001`

3. **Frontend Setup** (in a new terminal)
   ```bash
   cd memora-frontend
   npm install
   npm run dev
   ```
   Frontend will start on `http://localhost:5173`

4. **Database Setup**
   - Ensure MongoDB is running locally on port 27017
   - The application will automatically connect and create the `memora` database
   - No manual database setup required

## 📱 User Guide

### Getting Started
1. **Create Account**: Register with username, email, and secure password
2. **MemScore Evaluation**: Complete the comprehensive cognitive assessment
3. **Dashboard Overview**: Access your personalized learning hub
4. **Add Topics**: Create learning materials for spaced repetition
5. **Daily Reviews**: Follow the intelligent review schedule

### Cognitive Assessment Details

#### Memory Game
- **Preview Phase**: 10-second preview showing all card positions
- **Objective**: Find matching emoji pairs by clicking cards
- **Scoring Algorithm**: Based on wrong attempts (0 mistakes = 10 points, declining with errors)
- **Difficulty**: 4x4 grid with 8 pairs to match

#### Tile Recall Test
- **5 Progressive Rounds**: Increasing difficulty (3→5→7→9→11 tiles)
- **Sequence Learning**: Watch tiles light up, then reproduce the sequence
- **Scoring System**: 2 points per correct round, -0.5 penalty per mistake
- **Time Pressure**: Decreasing show time each round

#### Processing Speed Challenge
- **Duration**: 30-second rapid-fire math problems
- **Problem Types**: Addition, subtraction, and multiplication
- **Input Method**: Type answers and press Enter for quick submission
- **Scoring Formula**: (Correct answers / Total questions) × 10

### Spaced Repetition Workflow
1. **Topic Creation**: Add learning materials with title, content, and difficulty
2. **Initial Review**: System schedules first review based on difficulty
3. **Performance Rating**: Rate your recall quality (1-5 scale)
4. **Adaptive Scheduling**: Algorithm adjusts future intervals based on performance
5. **Progress Tracking**: Monitor retention rates and learning streaks

## 🔌 API Documentation

### Authentication Endpoints
```
POST /api/auth/register     # User registration
POST /api/auth/login        # User login
POST /api/auth/logout       # User logout
POST /api/auth/refresh      # Refresh access token
GET  /api/auth/verify       # Verify token validity
```

### User Management
```
GET  /api/user/profile      # Get user profile
PUT  /api/user/profile      # Update user profile
POST /api/user/evaluation   # Save MemScore results
GET  /api/user/memscore     # Get current MemScore
POST /api/user/study-session # Record study session
```

### Topic Management
```
GET    /api/topics          # Get user topics (with filtering)
POST   /api/topics          # Create new topic
GET    /api/topics/due      # Get topics due for review
GET    /api/topics/upcoming # Get upcoming review schedule
POST   /api/topics/:id/review # Submit topic review
PUT    /api/topics/:id      # Update topic
DELETE /api/topics/:id      # Delete topic
```

## 🛠️ Development

### Available Scripts

#### Frontend (memora-frontend/)
- `npm run dev` - Start development server (port 5173)
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

#### Backend (memora-backend/)
- `npm run dev` - Start development server with nodemon (port 3001)
- `npm start` - Start production server
- `npm test` - Run tests (placeholder)

### Environment Configuration

#### Backend (.env)
```env
PORT=3001
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/memora
JWT_SECRET=your-jwt-secret
JWT_REFRESH_SECRET=your-refresh-secret
FRONTEND_URL=http://localhost:5173
BCRYPT_SALT_ROUNDS=12
```

## 🗄️ Database Schema

### User Collection
```javascript
{
  _id: ObjectId,
  username: String (unique, 3-30 chars),
  email: String (unique, validated),
  password: String (bcrypt hashed),
  memScore: Number (0-10),
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
  refreshTokens: [{ token: String, expiresAt: Date }],
  createdAt: Date,
  updatedAt: Date
}
```

### Topic Collection
```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  title: String (max 200 chars),
  content: String (max 10000 chars),
  difficulty: Number (1-5),
  category: String, // "Science", "Mathematics", etc.
  tags: [String],

  // Spaced Repetition Fields
  easeFactor: Number (default: 2.5),
  interval: Number (days, default: 1),
  repetitions: Number (default: 0),
  nextReviewDate: Date,
  isLearning: Boolean (default: true),

  // Performance Tracking
  reviewCount: Number,
  averagePerformance: Number (0-1),
  lastReviewed: Date,

  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

## 🎯 Spaced Repetition Algorithm

### SM-2 Based Implementation
Memora uses an enhanced version of the SuperMemo SM-2 algorithm:

```javascript
// Quality ratings: 0-5 scale
// 0 = Complete blackout, 5 = Perfect response

if (quality < 3) {
  // Reset learning for poor performance
  repetitions = 0;
  interval = 1;
  isLearning = true;
} else {
  // Update ease factor based on quality
  easeFactor = max(1.3, easeFactor + (0.1 - (5-quality) * (0.08 + (5-quality) * 0.02)));

  // Calculate next interval
  if (repetitions === 0) interval = 1;
  else if (repetitions === 1) interval = 6;
  else interval = round(interval * easeFactor);

  repetitions++;
}
```

### Scoring Systems

#### MemScore Evaluation
- **Memory Game**: 0 mistakes = 10 points, declining with errors
- **Tile Recall**: 2 points per correct round, -0.5 penalty per mistake
- **Processing Speed**: (Correct answers / Total questions) × 10
- **Overall Score**: Average of all three tests (displayed as integers)

#### Topic Performance
- **Quality Scale**: 1-5 rating system for review performance
- **Adaptive Intervals**: Dynamic scheduling based on retention
- **Performance Tracking**: Average performance over time

## 🎨 Design Philosophy

### Cyber-Grid Aesthetic
- **Dark Theme Only**: Monochrome base with neon blue/green accents
- **Technical Interface**: Terminal-inspired components
- **Geometric Precision**: Sharp lines, no rounded elements
- **Vercel-Inspired**: Clean, professional design language
- **Micro-Animations**: Subtle interactions with Framer Motion

### User Experience Principles
- **Distraction-Free**: No scrollbars, perfect viewport fit
- **Responsive Design**: Mobile-first approach
- **Performance Focused**: 60fps animations, optimized rendering
- **Accessibility**: Keyboard navigation, screen reader support

## 🚧 Development Roadmap

### Phase 1: Core Foundation ✅
- [x] Landing page with cyber-grid aesthetic
- [x] JWT authentication system
- [x] User dashboard and profile management
- [x] MemScore cognitive assessment
- [x] Spaced repetition algorithm implementation

### Phase 2: Advanced Features 🔄
- [ ] **ReviseBy**: Deadline management system
- [ ] **Chronicle**: Calendar view for review scheduling
- [ ] **DocTags**: Attachment system (PDFs, YouTube, Drive links)
- [ ] **Difficulty Matrix**: Smart topic load balancing
- [ ] **Performance Analytics**: Advanced progress tracking

### Phase 3: Production Ready 📋
- [ ] Comprehensive testing suite
- [ ] Performance optimizations
- [ ] Security enhancements
- [ ] Deployment configuration
- [ ] Documentation completion

## 🔒 Security Features

### Authentication & Authorization
- **JWT Tokens**: Secure access/refresh token system
- **Password Security**: bcrypt hashing with 12 salt rounds
- **Token Rotation**: Automatic refresh token rotation
- **Session Management**: Secure token storage and cleanup

### Data Protection
- **Input Validation**: express-validator and Joi schemas
- **SQL Injection Prevention**: MongoDB parameterized queries
- **XSS Protection**: Helmet.js security headers
- **CORS Configuration**: Restricted cross-origin requests

## 🆘 Troubleshooting

### Common Issues

**Backend Connection Failed**
```bash
# Check if MongoDB is running
mongod --version
# Start MongoDB service
sudo systemctl start mongod  # Linux
brew services start mongodb-community  # macOS
```

**Port Conflicts**
- Frontend (5173): Vite will auto-select next available port
- Backend (3001): Modify PORT in .env file
- MongoDB (27017): Check for existing MongoDB instances

**Authentication Issues**
- Clear browser localStorage and cookies
- Verify JWT secrets in .env file
- Check token expiration settings

**Database Connection**
```bash
# Test MongoDB connection
mongo mongodb://localhost:27017/memora
# Or using MongoDB Compass GUI
```

### Performance Tips
- Use React DevTools for component profiling
- Monitor network requests in browser DevTools
- Check MongoDB query performance with explain()

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Follow the existing code style and conventions
4. Add tests for new functionality
5. Update documentation as needed
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

**Built with ❤️ for optimized learning and memory enhancement**

*Memora - Where Memory Meets Motion* 🧠✨
