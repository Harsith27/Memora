# Memora - Development Roadmap
**Ordered by Difficulty & Importance**

---

## 🚀 Phase 1: Core Foundation

### 1. 🏁 Landing Page (Core UI Design)
**Priority:** CRITICAL - Must impress from first look
**Components:**
- Hero section with "Sets Your Memory in Motion"
- Neon/technical animated grid background
- Call to action → Sign Up / Sign In
- Features preview: Neuro Engine, MemScore, ReviseBy, Chronicle
- Dark mode default (ONLY theme)

**Technical Requirements:**
- Responsive design with TailwindCSS
- Framer Motion animations for grid background
- Modular component structure
- Vercel-inspired aesthetic

### 2. 🔐 Authentication Pages (Login / Sign Up)
**Components:**
- JWT authentication system
- React form validation (username, email, password)
- Animation on submit (grid nodes lighting up)
- Terminal-like styled forms

**Backend Requirements:**
- JWT token generation and validation
- bcrypt password hashing
- User registration and login endpoints
- Secure session management

### 3. 📊 Dashboard (Main Hub)
**Layout Structure:**
- **Left Sidebar:** Dashboard, Chronicle, Assess, Docs, Settings
- **Top Info Block:** "Your MemScore Today", next revision event
- **Central Grid:** Today's topics, Upcoming topics (ReviseBy dates), Approaching deadlines

**Key Features:**
- Real-time data updates
- Color-coded topic difficulty
- Interactive topic cards
- Quick action buttons

---

## 🧠 Phase 2: Core Intelligence

### 4. 🧠 Neuro Engine (Backend Logic)
**Core Algorithm:**
- Calculates spaced intervals per topic
- **Factors Considered:**
  - User's default memory retention score
  - Difficulty scale (1–5 per topic/day)
  - Revision history
  - Deadline constraints (if set)

**Database Schema:**
- MongoDB collections for spaced-repetition schedules
- User performance tracking
- Topic metadata and history

### 5. 📅 Chronicle (Calendar View)
**Features:**
- Grid calendar layout
- **Daily Display:**
  - Topics to revise (color-coded by difficulty)
  - Quick add/edit icons
  - Smooth hover reveals (Vercel-style)
- Auto-scheduled events by Neuro Engine

### 6. 🎯 MemScore (Assessment System)
**Implementation:**
- Onboarding quiz OR manual self-assessment
- Performance score generation (0–100)
- Guides initial Neuro Engine spacing frequency
- Optional retake every 30 days for recalibration

---

## 📈 Phase 3: Advanced Features

### 7. 🚩 ReviseBy (Deadlines Feature)
**Functionality:**
- User-set "Revise By" dates for topics
- System avoids scheduling after deadline
- Red highlighting for approaching deadlines
- Smart deadline conflict resolution

### 8. 📎 DocTags (Attachments System)
**Supported Formats:**
- PDFs, YouTube links, Google Drive files
- Tag system for filtering ("Theory", "Coding", "Math")
- Tooltip/dropdown integration in Dashboard cards

### 9. 📶 Difficulty Matrix (Topic Load Balancing)
**Smart Scheduling:**
- User rates topics 1–5 (time/complexity)
- Neuro Engine load balancing:
  - Avoids overloading high-difficulty topics same day
  - Spreads complex topics strategically
  - Smart batching: One heavy + few light topics per day

---

## 🔧 Phase 4: Integrations & Polish

### 10. 🗓️ Google Calendar Integration (Optional Phase 2)
**Features:**
- OAuth + Google Calendar API
- Auto-add Memora revisions as events
- Sync options: once or continuous

### 11. ⚙️ Settings & User Preferences
**Customization Options:**
- Color themes: Monochrome, Neon Blue, Neon Green
- Default difficulty rating
- Retention speed: Fast, Medium, Slow
- MemScore recalibration frequency

### 12. 📈 Analytics (Optional Phase 2)
**Metrics Dashboard:**
- Total topics learned
- Average MemScore trends
- Revision frequency patterns
- Missed deadlines tracking
- GitHub commit heatmap style visualization

---

## 🧩 Component Architecture

### Modular Components
- `<TopicCard />` - Individual topic display
- `<ScheduleGrid />` - Calendar grid layout
- `<DifficultySlider />` - 1-5 difficulty selector
- `<ChronicleDay />` - Calendar cell with topic dots
- `<MemScoreBar />` - Progress bar with neural sparks
- `<TopicLog />` - History and next revision display
- `<NeuroPrediction />` - Editable revision predictions

### State Management
- Central context/state via Redux or React Context API
- User state management
- Topic state management
- Real-time updates

---

## 🔒 Development Guidelines

### Git Management
- **Commit Strategy:** One-liner meaningful messages
- **Sensitive Files:** Use .gitignore for:
  - Environment variables
  - API keys
  - Database credentials
  - AI prompt files
- **No dummy data** - minimal functional approach
- **Auto-commit:** After each major feature completion

### Code Quality
- Modular component structure
- Clean, maintainable code
- Proper error handling
- Performance optimization
- Security best practices

---

## 🎯 Success Metrics
- User engagement and retention
- Memory improvement effectiveness
- Revenue generation potential
- Scalability and performance
- User satisfaction scores
