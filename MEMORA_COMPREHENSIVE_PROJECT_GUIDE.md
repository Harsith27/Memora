# Memora Master System & Architectural Guide

This document serves as the absolute source of truth for the **Memora** learning productivity workspace. It covers the system's core vision, detailed directory structures, backend models, the adaptive spaced repetition algorithm, the front-end styling framework, production deployment runbooks, and current technical gaps/remediation guidelines.

---

## 1. Executive Summary & Product Vision

### 1.1 What is Memora?
Memora is a unified learning productivity platform designed to turn fragmented studying into a reliable, measurable, and repeatable learning loop. Instead of forcing learners to split their focus across note-taking apps, calendar planners, flashcard utilities, timer widgets, and diagram tools, Memora integrates:
1. **Spaced Revision:** Custom-scheduled review lists based on cognitive baseline profiling.
2. **DocTags (Structured Library):** Folder-like resource management to organize notes, documents, and external links directly next to revision topics.
3. **Chronicle (Timeline Planner):** A visual calendar to track exam deadlines, milestones, and daily study schedules.
4. **Journal (Daily Reflection):** Text templates for daily tracking, capturing user reflections on study performance and consistency.
5. **Visual Concept Mapping (Mindmaps & Graph Mode):** Graphical representations of ideas using force-directed networks to map connection hierarchies and view study histories over time.
6. **Focus Mode:** A low-distraction deep work countdown interface to execute study sessions and capture user metrics.
7. **Analytics:** Activity dashboards displaying workload forecasts, retention rates, and daily commitment trackers.

### 1.2 Target User Profiles
* **Academic Students:** Preparing for high-stakes examinations across multiple domains, requiring a balance of structured deadlines and retention tracking.
* **Technical Self-Learners:** Building deep expertise in software, engineering, mathematics, or languages, requiring visual mindmaps and strict conceptual mapping.
* **Professional Learners:** Keeping track of credentials, continuous education modules, and certifications while maintaining a busy career.

---

## 2. Directory Layout & File Catalog

```
Memora/
├── .github/
│   └── workflows/
│       ├── deploy-backend-azure.yml
│       └── deploy-frontend-vercel.yml
├── My Views/
│   ├── Suggestions.md
│   ├── errors.md
│   └── need work.md
├── extra_items/
│   ├── DEPLOYMENT_COMPLETE_GUIDE.md
│   ├── DEPLOYMENT_RUNBOOK.md
│   ├── DEPLOYMENT_STATUS_20260509.md
│   ├── DEPLOYMENT_SUPER_DETAILED_V2.md
│   ├── MEMORA_MASTER_SYSTEM_HANDBOOK.md
│   ├── Project-summary-v2.md
│   ├── copoilot-v2-executive-summary.md
│   └── project-docs/
│       ├── DEVELOPMENT_ROADMAP.md
│       ├── TECHNICAL_MANUAL_FOR_AI.md
│       └── TECHNICAL_SPECS.md
├── memora-backend/
│   ├── middleware/
│   │   └── auth.js
│   ├── models/
│   │   ├── index.js
│   │   ├── User.js
│   │   ├── Topic.js
│   │   ├── DocTag.js
│   │   ├── Journal.js
│   │   ├── Task.js
│   │   ├── RevisionHistory.js
│   │   ├── MemScoreHistory.js
│   │   ├── ListenerNote.js
│   │   └── AchievementLeaderboard.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── user.js
│   │   ├── topics.js
│   │   ├── doctags.js
│   │   ├── journal.js
│   │   ├── tasks.js
│   │   ├── mindmaps.js
│   │   └── listener.js
│   ├── utils/
│   │   ├── jwt.js
│   │   ├── email.js
│   │   └── fileStorage.js
│   ├── server.js
│   └── package.json
├── memora-frontend/
│   ├── public/                 [NEW - Target Public directory]
│   ├── src/
│   │   ├── components/
│   │   │   ├── AchievementUnlockNotifier.jsx
│   │   │   ├── AddDocTagModal.jsx
│   │   │   ├── AddTopicModal.jsx
│   │   │   ├── CyberGrid.jsx
│   │   │   ├── DailyUsageTracker.jsx
│   │   │   ├── FileViewer.jsx
│   │   │   ├── GlobalSearchBar.jsx
│   │   │   ├── GraphModeView.jsx
│   │   │   ├── MemScoreChart.jsx
│   │   │   ├── RevisionCard.jsx
│   │   │   └── SeoManager.jsx
│   │   ├── contexts/
│   │   │   ├── AuthContext.jsx
│   │   │   ├── TimerContext.jsx
│   │   │   └── TourContext.jsx
│   │   ├── pages/
│   │   │   ├── Achievements.jsx
│   │   │   ├── Analytics.jsx
│   │   │   ├── Chronicle.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── DocTags.jsx
│   │   │   ├── Docs.jsx
│   │   │   ├── Flashcards.jsx
│   │   │   ├── FocusMode.jsx
│   │   │   ├── Graph.jsx       [Dedicated decouped Graph route]
│   │   │   ├── Journal.jsx
│   │   │   ├── Landing.jsx
│   │   │   ├── Listener.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── MemScoreEvaluation.jsx
│   │   │   ├── Mindmaps.jsx
│   │   │   ├── Profile.jsx
│   │   │   └── SignUp.jsx
│   │   ├── services/
│   │   │   ├── api.js
│   │   │   ├── journalService.js
│   │   │   ├── docTagsService.js
│   │   │   ├── taskService.js
│   │   │   └── achievementsService.js
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── vercel.json
│   ├── vite.config.js
│   └── package.json
└── scripts/
    ├── deploy-backend-azure.sh
    ├── deploy-frontend-vercel.sh
    └── smoke-test-prod.sh
```

---

## 3. Database Layer & Mongoose Entity Catalog

The backend integrates with **MongoDB Atlas** using **Mongoose** as its ODM. The entity connections and structures are detailed below.

### 3.1 User (`User.js`)
Stores base user profile credentials, gamified streak data, cognitive baseline levels, and personalization preferences.
*   **Key Fields:**
    *   `username` / `email` (Unique, indexed strings).
    *   `password` (Bcrypt hash).
    *   `memScore` (Float, defaults to `0`, scaling from `0` to `10` to scale intervals).
    *   `hasCompletedEvaluation` (Boolean flags for onboarding routing).
    *   `streaks`: `currentStreak` (Integer), `longestStreak` (Integer), `lastActiveDate` (Date).
    *   `preferences`:
        *   `theme` (`dark` | `light`).
        *   `revisionMode` (`competitive` | `engineering` | `hybrid`).
        *   `retentionSpeed` (`fast` | `medium` | `slow`).
        *   `dailyReviewGoal` (Integer, default `5`).

### 3.2 Topic (`Topic.js`)
Tracks the primary learning blocks. It owns the parameters fed into the spaced repetition scheduler.
*   **Key Fields:**
    *   `title` (String, indexed for text search).
    *   `content` (String, text-searchable description).
    *   `userId` (ObjectId pointing to `User`, indexed).
    *   `tags` (Array of strings, indexed).
    *   `difficulty` (Integer, `1` = Easy to `5` = Expert).
    *   `category` (Science, Mathematics, Technology, etc.).
    *   `attachments` (Filenames, original names, URLs, size metrics, uploaded dates).
    *   `externalLinks` (Custom titles, URLs, types: YouTube, Drive, GitHub).
    *   **Interval Engine Fields:**
        *   `easeFactor` (Float, bounds: `1.3` to `3.2`, default `2.5`).
        *   `interval` (Integer, in days, bounds: `1` to `180`).
        *   `repetitions` (Integer count of consecutive successful reviews).
        *   `nextReviewDate` (Date, default `Date.now`, indexed).
        *   `isLearning` (Boolean, flags if topic is below target repetition).
        *   `deadlineDate` (Date, target date for complete acquisition).
        *   `deadlineType` (`hard` | `soft`).
        *   `rescheduleCount` (Used to track anti-crowding adjustments).

### 3.3 DocTag (`DocTag.js`)
Handles virtual folders and documents. Represents resources uploaded locally or referenced via cloud URLs.
*   **Key Fields:**
    *   `name` (String, name of folder or resource).
    *   `type` (`folder` | `file` | `link`).
    *   `parentId` (ObjectId pointing back to parent `DocTag` directory, creating a recursive file structure).
    *   `userId` (ObjectId pointing to `User`).
    *   `fileUrl` / `fileSize` / `mimeType` (Metadata for binaries).
    *   `linkedTopicIds` (Array of ObjectIds pointing to `Topic` models).
    *   `isFavorite` (Boolean flag).

### 3.4 Journal (`Journal.js`)
Captures reflection journals mapping to calendar dates.
*   **Key Fields:**
    *   `userId` (ObjectId).
    *   `date` (String, unique key formatted as `YYYY-MM-DD`).
    *   `content` (Markdown string containing notes).
    *   `mood` (Emoji or integer index representing emotion).
    *   `tags` (String categories).
    *   `summary` (AI-extracted short summary, if applicable).

### 3.5 RevisionHistory (`RevisionHistory.js`)
Granular tracking of every single review event. Used to plot analytics and feed back into the evaluation modules.
*   **Key Fields:**
    *   `userId` / `topicId` (ObjectIds, indexed).
    *   `quality` (Integer, `0` to `5`).
    *   `responseTime` (Number, seconds to answer).
    *   `difficulty` (At time of review).
    *   `wasCorrect` (Boolean, `quality >= 3`).
    *   `intervalBefore` / `intervalAfter` (Changes in date schedules).
    *   `easeFactorBefore` / `easeFactorAfter`.
    *   `timeOfDay` (`morning` | `afternoon` | `evening` | `night`).

### 3.6 Other Auxiliary Entities
*   **Task (`Task.js`):** Checklist item owning fields like `title`, `isCompleted`, `dueDate`, and `priority`.
*   **MemScoreHistory (`MemScoreHistory.js`):** Historical logs of game evaluations (Memory Match, Tile Recall, Speed Test) plotting user cognitive baseline improvements.
*   **ListenerNote (`ListenerNote.js`):** Audio transcriptions and processed study notes captured via the microphone listener route.

---

## 4. Spaced Repetition Scheduling Engine

The heartbeat of Memora is its advanced cognitive spacing scheduler located inside [Topic.js](file:///c:/Harsith_Dev/Memora/memora-backend/models/Topic.js#L438-L590). It updates intervals dynamically whenever a user clicks "Review" and submits a quality score.

### 4.1 Core Parameters
Spaced repetition scheduling calculations utilize:
*   **Quality Score ($q$):** Submitted from the frontend `RevisionCard` (values `0` to `5`):
    *   `0`: Complete blackout / forgotten.
    *   `1`: Incorrect response, but recognized upon reveal.
    *   `2`: Incorrect response, but easily recalled with a hint.
    *   `3`: Correct response, recalled with difficulty/hesitation.
    *   `4`: Correct response, recalled after minor delay.
    *   `5`: Perfect response, immediate recall.
*   **Ease Factor ($EF$):** Measures the stability of the memory trace. Starts at `2.5` and updates at review step by adding $\Delta EF$:
    $$\Delta EF = [-0.18, -0.12, -0.06, 0.0, +0.05, +0.10] \text{ corresponding to } q \in [0, 1, 2, 3, 4, 5]$$
    *   **EF Constraints:** Hard clamped between $EF_{min} = 1.3$ and $EF_{max} = 3.2$.
*   **Repetition Count ($n$):** Measures the number of successful consecutive recall attempts.
    *   If $q \ge 3$, repetitions increment by `1`.
    *   If $q = 2$, repetitions decrement by `1` (minimum `0`).
    *   If $q \le 1$, repetitions decrement by `2` (minimum `0`).

### 4.2 Spaced Revision Modes
Users can configure their study profile globally or override modes per topic:
1.  **Competitive Mode:** Focused on long-term storage and retention.
    *   Target Revision Count ($R_{target}$): $3 \text{ to } 7$ steps (scales with higher difficulty).
    *   Target Period Horizon ($P_{target}$): $15 \text{ to } 75$ days.
2.  **Engineering Mode:** High-velocity sprint reviews, typical for engineering formulas or code syntaxes.
    *   Target Revision Count ($R_{target}$): $1 \text{ to } 3$ steps.
    *   Target Period Horizon ($P_{target}$): $8 \text{ to } 36$ days.
3.  **Hybrid Mode:** Automatically selects scheduling limits:
    *   If Topic Difficulty $\ge 4$ $\rightarrow$ Competitive Mode.
    *   If Topic Difficulty $< 4$ $\rightarrow$ Engineering Mode.

### 4.3 Cognitive and Contextual Multipliers
The baseline calculation scales using three critical factors to determine the adaptive scale multiplier ($S_{adaptive}$):
1.  **Cognitive Scaling Factor ($M_{cognitive}$):** Based on the user's latest MemScore assessment (ranging from `0` to `10`):
    $$M_{cognitive} = 0.9 + \left(\frac{\text{MemScore}}{10}\right) \times 0.2$$
    *   *Effect:* High baseline retention capacity expands intervals up to $1.1\times$, while lower scores compress them to $0.9\times$.
2.  **Retention Speed Multiplier ($M_{retention}$):** Checked from user profile configurations:
    *   `fast` $\rightarrow 1.05$
    *   `medium` $\rightarrow 1.00$
    *   `slow` $\rightarrow 0.95$
3.  **Response Time Multiplier ($M_{response}$):** Evaluated from response times tracked in milliseconds:
    *   $\le 8$ seconds (Fast) $\rightarrow 1.03$
    *   $9 - 25$ seconds (Normal) $\rightarrow 1.00$
    *   $26 - 60$ seconds (Slow) $\rightarrow 0.96$
    *   $> 60$ seconds (Very Slow) $\rightarrow 0.90$
4.  **Overdue Adjustment ($A_{overdue}$):** If a user returns to a topic late and scores $q \ge 4$, they receive a spacing reward because their memory survived a longer interval:
    $$A_{overdue} = \min\left(1.12, 1.0 + \text{overdueDays} \times 0.01\right)$$

The final adaptive scale is bounded:
*   Competitive/Hybrid: $\text{clamp}(S_{adaptive}, 0.9, 1.15)$
*   Engineering: $\text{clamp}(S_{adaptive}, 0.82, 1.08)$

### 4.5 Interval Spacing Calculations
Let $I_{prev}$ be the previous interval (in days).
1.  **If the review is failed ($q \le 1$):**
    The interval collapses:
    $$I_{new} = 1 \text{ day}$$
2.  **If the review is marginal ($q = 2$):**
    Interval undergoes decay:
    $$I_{new} = \max\left(2, \text{round}\left(I_{prev} \times 0.8\right)\right)$$
3.  **If the review is correct ($q \ge 3$):**
    Calculate progress proportion ($SP$):
    $$SP = \text{clamp}\left(\frac{R_{prev}}{R_{planned} - 1}, 0, 1\right)$$
    *   Calculate curve growth factor:
        *   Competitive: $CG = 1.55 + (SP \times 0.5)$
        *   Engineering: $CG = 1.35 + (SP \times 0.35)$
    *   Calculate projected interval:
        $$I_{projected} = \text{round}\left(I_{prev} \times CG \times M_{quality} \times S_{adaptive}\right)$$
        *   Where $M_{quality}$ is a multiplier for quality scores ($q = 3 \rightarrow 1.0$, $q = 4 \rightarrow 1.12$, $q = 5 \rightarrow 1.22$).
    *   Ensure interval growth safety:
        $$I_{new} = \max\left(I_{projected}, \text{round}\left(I_{prev} \times 1.1\right)\right)$$

### 4.6 Deadline and Compression Settings
If the topic owns a `deadlineDate` and is configured with a **hard** deadline, intervals are restricted to prevent scheduling reviews past the deadline:
$$I_{new} = \min\left(I_{new}, \text{daysUntilDeadline} - \text{remainingPlannedReviews}\right)$$
Additionally, hard deadlines trigger a compression scale multiplier to pack the remaining reviews into the remaining days.

### 4.7 Crowding Prevention (Load Balancing)
When multiple topics accumulate on the same `nextReviewDate`, users can run the "Prevent Crowding" command from the UI. This triggers [topics.js:982](file:///c:/Harsith_Dev/Memora/memora-backend/routes/topics.js#L982) to call an aggregation query evaluating:
*   **Weighted daily load thresholds:** Based on average topic difficulty:
    $$\text{Threshold}_{crowded} = 5 \times \text{Multiplier}_{difficulty}$$
    *   Expert difficulty (5) lowers the limit to $\approx 3$ topics/day to prevent cognitive burnout.
    *   Easy difficulty (1) allows up to $\approx 7$ topics/day.
*   **Rescheduling logic:** Topics exceeding these thresholds are shifted to adjacent days with lighter study loads, updating `rescheduleCount` on the database schema.

---

## 5. UI Design System & Component Library

Memora uses a consistent dark mode theme with glassmorphism panels, borders, and radial gradients.

### 5.1 CSS Tokens & Custom Styling Variables
Defined in [index.css](file:///c:/Harsith_Dev/Memora/memora-frontend/src/index.css#L15-L22):
*   `--font-sans`: `'Geist'`, `Arial`, `sans-serif` (clean modern typography).
*   Background colors are near-black `#000000` / `#050608` with cards on `#0b0e12` to create depth.
*   Borders use translucent dividers: `rgba(255, 255, 255, 0.06)`.
*   Interactive elements use:
    *   `--color-cyber-blue` (accent highlights).
    *   Accent violet (for maximizing and emphasis).
    *   Teal (for time-lapse playbacks).

### 5.2 Cursor Hover Interactive Canvas: Cyber-Grid
Located in [CyberGrid.jsx](file:///c:/Harsith_Dev/Memora/memora-frontend/src/components/CyberGrid.jsx):
*   Uses a `ref` mapping to catch mouse movement. It translates client cursor points into grid percentages (`--mouse-x`, `--mouse-y`).
*   A radial background layer renders light tracking details dynamically:
    ```css
    background: radial-gradient(circle at var(--mouse-x) var(--mouse-y), rgba(0, 212, 255, 0.3) 0%, transparent 50%);
    ```
*   Integrates random animated `framer-motion` nodes simulating floating particles.

### 5.3 Sleek Layout & Responsive Custom Scrollbars
To keep interfaces clean, scrollbars are hidden by default:
```css
* { scrollbar-width: none; }
*::-webkit-scrollbar { display: none; }
```
For dense panels, overlays, or forms, a custom styled scrollbar utility is exposed:
*   `.scrollbar-themed` renders a subtle grey rounded scroll thumb (`rgba(94, 101, 112, 0.9)`) on a transparent track to match dark layouts.

---

## 6. Production Deployment Setup

The production setup uses a decoupled, script-driven pipeline to deploy the frontend to Vercel and the backend to Azure.

### 6.1 Vercel Frontend Pipeline
*   **Production Alias:** `https://memoraapp-next.vercel.app`
*   **Redirect Rules:** Managed via [vercel.json](file:///c:/Harsith_Dev/Memora/memora-frontend/vercel.json), mapping client calls to backend locations:
    ```json
    {
      "rewrites": [
        { "source": "/api/(.*)", "destination": "https://memora-api-04021453.azurewebsites.net/api/$1" },
        { "source": "/uploads/(.*)", "destination": "https://memora-api-04021453.azurewebsites.net/uploads/$1" },
        { "source": "/(.*)", "destination": "/index.html" }
      ]
    }
    ```
*   **Deploy Workflow ([deploy-frontend-vercel.yml](file:///c:/Harsith_Dev/Memora/.github/workflows/deploy-frontend-vercel.yml)):**
    *   Pulls project configuration credentials using `vercel pull`.
    *   Builds production artifacts locally inside the runner via `vercel build`.
    *   Deploys the built files using `vercel deploy --prebuilt`.
    *   Sets Vercel domain alias settings to `memoraapp-next.vercel.app`.

### 6.2 Azure Backend Pipeline
*   **Production URL:** `https://memora-api-04021453.azurewebsites.net`
*   **Build Optimization Settings:** Managed through Azure App Service App Settings:
    *   `WEBSITE_RUN_FROM_PACKAGE=0`
    *   `SCM_DO_BUILD_DURING_DEPLOYMENT=true`
    *   `ENABLE_ORYX_BUILD=true`
    These settings allow the server container to run npm installs and build steps locally, reducing upload sizes.
*   **Packaging Script ([deploy-backend-azure.sh](file:///c:/Harsith_Dev/Memora/scripts/deploy-backend-azure.sh)):**
    *   Runs an inline python block to traverse `memora-backend`.
    *   Excludes massive folders (`node_modules`, `.git`) and local `.env` keys.
    *   Zips the source code directory, compressing the payload size from **~120MB** down to **~2MB**.
    *   Uploads the zip file using `az webapp deploy --type zip`.
    *   Polls the health check URL (`/api/health`) to verify a healthy status before exiting.

---

## 7. Operational Audit & Remediation Manual

The project has some minor configuration issues that can be fixed using the tasks below.

### Task 1: Create Static Public Files
*   **Issue:** Vite builds require static files (robots instructions, search indexes, PWA maps) in a `/public` root folder. Currently, this folder is missing from `memora-frontend/`. Rewrites send crawler bots looking for `sitemap.xml` or `robots.txt` directly to `/index.html`, returning raw HTML instead of XML/plaintext, which breaks indexing.
*   **Remediation:**
    1.  Create `memora-frontend/public/` directory.
    2.  Write [sitemap.xml](file:///c:/Harsith_Dev/Memora/memora-frontend/public/sitemap.xml) routing to current pages (`/`, `/login`, `/signup`, `/pricing`, `/docs`).
    3.  Write [robots.txt](file:///c:/Harsith_Dev/Memora/memora-frontend/public/robots.txt) allowing search crawls on public routes, while blocking private folders (`/dashboard`, `/graph`, `/topics`, `/focus`).
    4.  Create [manifest.json](file:///c:/Harsith_Dev/Memora/memora-frontend/public/manifest.json) matching branding rules.

### Task 2: Correct GitHub Action Workflow Configurations
*   **Issue:** 
    1.  The frontend workflow `deploy-frontend-vercel.yml` pulls environment info but misses `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` inside the pulling step's environment block. The runner crashes because Vercel CLI has no local project context.
    2.  It needs a push trigger on branches to deploy on merges automatically.
*   **Remediation:**
    1.  Expose the three credentials (`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`) directly within the environment block of the Vercel pull step in [.github/workflows/deploy-frontend-vercel.yml](file:///c:/Harsith_Dev/Memora/.github/workflows/deploy-frontend-vercel.yml).
    2.  Add automatic branch push triggers to deploy when code changes.

### Task 3: Update Hardcoded Web App Domain Targets
*   **Issue:** Inconsistent URL naming. The live site runs on `https://memyapp.vercel.app/` (with local scripts matching `memyapp.vercel.app` or `memoraapp-next.vercel.app`), but the hardcoded SEO manager uses `memy.vercel.app`. This splits authority.
*   **Remediation:**
    1.  Update `SITE_URL` in [SeoManager.jsx](file:///c:/Harsith_Dev/Memora/memora-frontend/src/components/SeoManager.jsx#L5) to point to the current production domain.
    2.  Change canonical links in [index.html](file:///c:/Harsith_Dev/Memora/memora-frontend/index.html#L17) to match.

### Task 4: Fix Stale Local Deploy Scripts
*   **Issue:** The local Vercel deploy script has a fallback domain parameter pointing to a deprecated legacy location.
*   **Remediation:**
    1.  Update the fallback alias variable inside [deploy-frontend-vercel.sh](file:///c:/Harsith_Dev/Memora/scripts/deploy-frontend-vercel.sh#L6) to target the correct production endpoint.

---

## 8. Summary Checklist for Work Verification

To verify these fixes:
1.  **Local Testing:** Validate build processes locally after changes:
    *   `cd memora-frontend && npm run build` (verifies files in `/public` copy to `/dist` root).
2.  **Local Script Runs:** Confirm deployment scripts execute cleanly.
3.  **Smoke Checks:** Run [smoke-test-prod.sh](file:///c:/Harsith_Dev/Memora/scripts/smoke-test-prod.sh) to verify all URLs return healthy HTTP 200 responses.

---

## 9. Feature Module Specifications & Technical Workings

This section details the inner mechanics, formulas, and client-server interactions of each individual module.

### 9.1 MemScore Evaluation Phase
*   **Purpose:** Establishes the user's baseline memory retention level before they access the core study modules.
*   **Implementation ([MemScoreEvaluation.jsx](file:///c:/Harsith_Dev/Memora/memora-frontend/src/pages/MemScoreEvaluation.jsx)):**
    1.  **Memory Game:** A card-matching board. The game scores memory based on wrong attempts:
        *   0 wrong $\rightarrow 10$
        *   1 wrong $\rightarrow 9$
        *   2-3 wrong $\rightarrow 8$
        *   4-5 wrong $\rightarrow 7$
        *   6-8 wrong $\rightarrow 6$
        *   $>8$ wrong $\rightarrow \max(1, 5 - \lfloor(wrongAttempts - 8) / 3\rfloor)$
    2.  **Tile Recall:** A grid-memorization task where users click a highlighted cell sequence.
        *   Each round yields 2 points for a correct choice and 0 for wrong.
        *   Final score: $\max(1, \text{round}((\text{correctRounds} / \text{totalRounds}) \times 10) - \text{wrongPenalty})$.
    3.  **Speed Test:** Arithmetic or shape recognition under time pressure.
        *   Final score: $\max(1, (\text{correctAnswers} / \text{totalQuestions}) \times 10)$.
*   **Overall MemScore:** The mathematical average:
    $$\text{MemScore}_{overall} = \text{round}\left( \frac{\text{MemoryGame} + \text{TileRecall} + \text{SpeedTest}}{3} \right)$$
    This score is stored under `User.memScore` and scales spaced repetition intervals globally.

### 9.2 Dashboard Command Center
*   **Purpose:** The default entry landing page, showing due revision counts and quick actions.
*   **Implementation ([Dashboard.jsx](file:///c:/Harsith_Dev/Memora/memora-frontend/src/pages/Dashboard.jsx)):**
    *   Loads due topics via `api/topics/due` and upcoming loads via `api/topics/workload`.
    *   Integrates a POMODORO countdown timer widget calling `TimerContext` so that focus sessions run uninterrupted while browsing topics.
    *   Features sidebar navigation mapped dynamically using standard configuration items from [sidebarNavigation.js](file:///c:/Harsith_Dev/Memora/memora-frontend/src/constants/sidebarNavigation.js).

### 9.3 DocTags Resource Cabinet
*   **Purpose:** A recursive resource explorer mapping study resources to topics.
*   **Implementation ([DocTags.jsx](file:///c:/Harsith_Dev/Memora/memora-frontend/src/pages/DocTags.jsx)):**
    *   **Folder Structure:** Built recursively where folder nodes point to their parent via `parentId`. Root nodes have `parentId = null`.
    *   **Upload Pipeline ([doctags.js](file:///c:/Harsith_Dev/Memora/memora-backend/routes/doctags.js)):** Uses `multer` to handle files. Depending on `FILE_STORAGE_PROVIDER`, files are stored locally in `uploads/` or pushed to Azure Blob Container.
    *   **Topic Linkage:** The `linkedTopicIds` array ties resource files directly to spaced repetition cards, enabling users to open file attachments directly within the revision interface.
    *   **Auto-Documents:** Includes `createDocumentFromTopic` in [docTagsService.js](file:///c:/Harsith_Dev/Memora/memora-frontend/src/services/docTagsService.js#L209) to automatically compile topic contents, attachments, and external links into a markdown file tag.

### 9.4 Chronicle Event Planner
*   **Purpose:** Timeline view that synchronizes study events and milestones.
*   **Implementation ([Chronicle.jsx](file:///c:/Harsith_Dev/Memora/memora-frontend/src/pages/Chronicle.jsx)):**
    *   Renders calendar grids mapped via string dates (`YYYY-MM-DD`).
    *   Pulls tasks from the checklist database and overlays milestone dates and exam targets on the calendar slots.

### 9.5 Journal Dynamic Reflections
*   **Purpose:** Structured reflection tool tracking study performance and consistency.
*   **Implementation ([Journal.jsx](file:///c:/Harsith_Dev/Memora/memora-frontend/src/pages/Journal.jsx)):**
    *   Uses templates containing metadata placeholders (`{{revisions_count}}`, `{{focus_minutes}}`, `{{tasks_completed}}`).
    *   **RegEx Lock Guards:** Enforces template integrity by preventing manual editing of structural headings:
        *   Daily template locked headings: `# Overview`, `# Activities`
        *   Weekly/Monthly template locked headings: `# Overview`, `# Topics Studied`
        *   Upon saving, `enforceLockedTemplateSections` uses RegEx matching to extract user modifications, verify structural headings match `defaultJournalTemplates`, and re-inject locked blocks.

### 9.6 Mindmaps & AI Generation
*   **Purpose:** Creates visual node-link trees mapping concept hierarchies.
*   **Implementation ([Mindmaps.jsx](file:///c:/Harsith_Dev/Memora/memora-frontend/src/pages/Mindmaps.jsx)):**
    *   Draws SVG connections between topic parent and child nodes.
    *   **AI Provider Fallback ([mindmaps.js](file:///c:/Harsith_Dev/Memora/memora-backend/routes/mindmaps.js#L812)):**
        *   Submits structured JSON prompts to Groq API.
        *   If the Groq API key is expired or missing, the backend returns a mock map using `buildTemplateMindmap` to prevent UI exceptions.

### 9.7 Decoupled Graph Mode
*   **Purpose:** Fully decoupled force-directed visual network mapping all topics and links.
*   **Implementation ([Graph.jsx](file:///c:/Harsith_Dev/Memora/memora-frontend/src/pages/Graph.jsx) & [GraphModeView.jsx](file:///c:/Harsith_Dev/Memora/memora-frontend/src/components/GraphModeView.jsx)):**
    *   **Layout Decoupling:** Decoupled from the dashboard, operating on `/graph` with its own page layout.
    *   **D3 Physics Simulation:** Instantiates `forceSimulation` using `charge` (-165), `center` (0,0), `collision` radius, and a custom `createLabelCollisionForce` callback to prevent node labels from overlapping.
    *   **Maximize View:** Toggling maximize hides layout chromes (sidebar, header) and sets `document.body.dataset.hideGlobalDock = 'true'` to suppress the profile dock.
    *   **Rendering Optimization:** The HTML5 Canvas rendering loop uses world-distance calculations:
        `if (!connectedToFocus && worldDistPx > hardPruneThreshold && zoom < 0.85)`
        This prunes label rendering and line drawings for distant nodes when zoomed out, maintaining 60 FPS on large graphs.

### 9.8 Focus Mode Countdown
*   **Purpose:** High-concentration Pomodoro interface to execute study sessions.
*   **Implementation ([FocusMode.jsx](file:///c:/Harsith_Dev/Memora/memora-frontend/src/pages/FocusMode.jsx)):**
    *   Supports `countdown` and `stopwatch` modes.
    *   **Timer Persistence:** Hydrates timer state using `focusModeTimerState` localStorage snapshots:
        `const snapshot = readStoredTimerSnapshot(storageKey);`
        This handles unexpected browser refreshes, tab closures, or route changes without interrupting active focus timers.
    *   Upon completion, invokes `apiService.logStudySession` to sync user streak progression.

### 9.9 Achievements & Puzzle Leaderboard
*   **Purpose:** A gamified achievements panel that tracks user learning progress.
*   **Implementation ([Achievements.jsx](file:///c:/Harsith_Dev/Memora/memora-frontend/src/pages/Achievements.jsx) & [achievementsService.js](file:///c:/Harsith_Dev/Memora/memora-frontend/src/services/achievementsService.js)):**
    *   **Puzzle Reveals:** Users unlock pieces of high-resolution wallpapers (`/wallpapers/*.jpg`) by hitting daily study goals, focus timers, and checklist clears.
    *   **Leaderboard Sync:** POST `/api/user/achievements/leaderboard-sync` updates user scores:
        $$\text{Score} = (\text{completedPuzzles} \times 1000) + (\text{claimedPieces} \times 10) + \text{totalClaims}$$
    *   GET `/api/user/achievements/leaderboard` fetches the global leaderboard rankings.
