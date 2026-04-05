# Project Summary V2

## 1. Project Identity

### Project name
Memora

### Project type
Learning productivity platform for students and self-learners.

### Core value
Memora combines spaced revision, structured notes, visual concept mapping, focused sessions, and analytics in a single workflow so users can learn consistently and retain better over time.

## 2. Product Vision
Memora aims to be a daily operating system for learning.
Instead of splitting workflow across many tools, the product keeps capture, planning, revision, reflection, and performance analysis in one consistent interface.

### Vision statement
Turn fragmented studying into a reliable, measurable, and repeatable learning loop.

## 3. Problem Statement
Learners commonly face these issues:
- Notes are scattered across folders and apps.
- Revision plans are inconsistent and reactive.
- Deep focus sessions are not tracked with context.
- Learners cannot easily visualize concept relationships.
- There is little visibility into progress quality over time.

Memora addresses this by integrating:
- Topic lifecycle tracking
- Review scheduling
- Resource organization
- Journal and event planning
- Focus mode and analytics

## 4. Target Users
- College students managing multiple subjects
- Competitive exam learners
- Self-learners building technical depth
- Team learners managing shared preparation plans

## 5. Product Pillars
- Clarity: clean information hierarchy and discoverable actions
- Continuity: one place for all study activities
- Consistency: repeatable daily workflow
- Feedback: analytics and trend visibility
- Scalability: suitable from a few topics to very large topic graphs

## 6. Core Modules Overview

### 6.1 Dashboard
Purpose:
- Entry point and command center

Main capabilities:
- Overview cards and quick access actions
- Daily revision context
- Global search access
- Navigation into high-priority modules

### 6.2 Topics
Purpose:
- Manage learning units with metadata

Main capabilities:
- Create and edit topics
- Difficulty and category labeling
- Review count and schedule tracking
- Topic lifecycle support

### 6.3 DocTags
Purpose:
- Organize learning resources and files

Main capabilities:
- Folder/document-style workspace organization
- Attach and access files
- Link resources to topic context
- Structured retrieval of study material

### 6.4 Chronicle
Purpose:
- Calendar planning and timeline management

Main capabilities:
- Event scheduling
- Date-centric planning
- Milestone visibility
- Alignment of study tasks with deadlines

### 6.5 Journal
Purpose:
- Reflection and daily writing

Main capabilities:
- Daily entries
- Settings-driven journaling behavior
- Historical context for learning progress
- Optional templates and structured prompts

### 6.6 Mindmaps
Purpose:
- Visual concept modeling

Main capabilities:
- Node and edge-based concept maps
- Topic-linked map creation
- Navigation and layout interactions
- Visual synthesis of complex topics

### 6.7 Graph Mode
Purpose:
- Network-level view of topics and linked resources

Main capabilities:
- Node-link graph visualization
- Filters and focus controls
- Time-lapse playback of graph reveal
- Maximize view mode
- Adaptive controls for dense graphs

### 6.8 Focus Mode
Purpose:
- Deep-work execution layer

Main capabilities:
- Focus session controls
- Session progression and completion
- Reduced distraction workflow
- Productivity tracking support

### 6.9 Analytics
Purpose:
- Outcome and trend visibility

Main capabilities:
- Activity intelligence
- Trend charts and usage patterns
- Retention and behavior signals
- Data-backed performance feedback

### 6.10 Profile
Purpose:
- User-level preferences and tour controls

Main capabilities:
- Account-level preferences
- Navigation tour controls
- Personal configuration layer

## 7. End-to-End User Flow

### Primary flow
1. Capture or update topics in Topics.
2. Attach resources in DocTags.
3. Plan key dates in Chronicle.
4. Execute revision from Dashboard and module actions.
5. Use Focus Mode for deep sessions.
6. Reflect in Journal.
7. Review patterns in Analytics.
8. Explore concept relationships via Mindmaps and Graph Mode.

### Graph-specific flow
1. Open Graph page.
2. Use Maximize View for immersive network focus.
3. When maximized, run Graph Time Lapse from navbar.
4. Use center-and-fit for large node sets.
5. Inspect node details and related metadata.

## 8. Information Architecture
- Top-level route architecture by module
- Shared global navigation scaffold
- Module-owned local states for complex interactions
- Command-style interaction support for cross-module jumping

## 9. Frontend Technical Stack
- React
- Vite
- Tailwind utility classes
- React Router
- Context and hook-driven state composition

## 10. Backend Technical Stack
- Node.js
- Express
- MongoDB models/routes pattern
- JWT-based auth support
- Modular route separation

## 11. Data and Domain Entities
- User
- Topic
- Journal
- RevisionHistory
- DocTag
- MemScoreHistory
- Related scheduling and metadata entities

## 12. UI Design System Summary

### 12.1 Visual direction
Memora follows a dark, high-contrast interface language with accent-based semantic actions.

### 12.2 Color strategy
Observed active palette includes:
- Base background: near-black
- Primary text: white/off-white
- Secondary text: gray scales
- Accent cyan: exploration and interactive highlights
- Accent violet: maximize/emphasis controls
- Accent teal: time-lapse/playback controls
- Neutral whites for secondary utility controls

### 12.3 Button hierarchy
- Primary action: stronger border and accent background
- Secondary action: neutral border/background with hover elevation
- Contextual controls: compact utility style for toolbars

### 12.4 Graph control styling
- Maximize control themed in violet
- Time-lapse control themed in bluish-green/teal
- Time-lapse visibility conditional on maximize state in navbar

### 12.5 Surfaces and layering
- Borders use subtle opacity values to preserve depth
- Panels segmented with low-contrast separators
- Action zones grouped by function

## 13. Typography

### Current implementation profile
- Utility-driven typography classes
- Consistent use of weight and size ramps for hierarchy
- Strong contrast for headings and action labels

### Practical style guide
- H1: 2xl equivalent with semibold/strong emphasis
- Module subtitle: small muted gray
- Body text: readable medium-small balance
- Toolbar labels: compact yet clear

### Future typography recommendations
- Standardize one headline scale map
- Add explicit typography tokens
- Document line-height rules for dense dashboards

## 14. Layout and Composition Patterns
- Fixed sidebar + flexible content region pattern
- Header toolbar with module title + action controls
- Scrollable content body with stable top controls
- Collapsible sidebar for compact viewport mode
- Card-based sections for modular readability

## 15. Component Utility Landscape
Representative utility components and patterns:
- Modal/Dialog framework
- Toast notifications
- Select controls
- File viewer and resource browsers
- Profile UI utilities
- Graph visualization and interaction controls

## 16. State Management Approach
- Local state for module-specific interactions
- Context providers for cross-cutting concerns
- Hook-based data orchestration
- Tokenized command dispatch patterns for child-control synchronization

## 17. Graph Mode Engineering Notes

### Functional controls
- Zoom in/out
- Reset view
- Center graph
- Center-and-fit behavior for large networks
- Filter panel toggles
- Time-lapse playback

### UX behavior currently aligned
- Navbar initially shows Maximize only
- Time Lapse appears when maximized
- Time Lapse appears left of Maximize

### Scalability additions
- Expanded zoom range to support dense future node sets
- Fit-to-frame centering introduced for better macro-level visibility

## 18. Search and Commanding
- Global search designed as cross-module navigation accelerator
- Command-style paths for date and module jumps
- Search presentation aligned with user-readable date formats

## 19. Deployment Architecture

### Frontend
- Vercel production deployment
- Explicit alias mapping to stable production URL

### Backend
- Azure App Service deployment via zip strategy
- Scripted artifact refresh before deploy
- Health check verification after deploy

### Routing behavior
- Frontend rewrites to backend endpoints for API/uploads

## 20. Deployment Reliability Improvements Captured
- Removed unsupported CLI flag usage in deploy script
- Added robust URL parsing in workflow deploy step
- Enforced explicit alias mapping behavior
- Added playbook-grade deployment documentation

## 21. Security and Operational Considerations
- Secret management should be centralized in vault
- Token and connection values must never be committed
- CI secrets and variable owners should be clearly assigned
- Role-based responsibility for deploy and rollback should be explicit

## 22. Performance Considerations
- Large chunk warnings observed in production builds
- Current warnings are non-blocking but indicate optimization opportunities

Recommended next performance actions:
- Introduce strategic route-level split boundaries
- Add manual chunk strategy where needed
- Track bundle size over time in CI checks

## 23. Testing and Quality Gaps to Close
- Add module smoke test script for production
- Add route-behavior assertions for Graph and Dashboard separation
- Add interaction tests for conditional navbar controls in Graph
- Add regression check for large-graph center-and-fit behavior

## 24. Suggested Folder-Level Governance
- Keep runtime code changes limited to module scopes
- Keep temporary/procedural docs under extra_items
- Keep deployment scripts under scripts with version notes
- Keep CI workflow commands aligned with CLI version behavior

## 25. Suggested Milestone Plan (V2+)

### Phase A: Stability
- Lock Graph interaction behavior
- Add smoke checks
- Tag stable release

### Phase B: Performance
- Bundle split optimization
- Graph rendering profiling for large datasets

### Phase C: Product depth
- Better analytics narratives
- Enhanced journaling intelligence
- Improved collaborative workflows

## 26. Suggested Metrics
- Daily active study sessions
- Topic review completion rate
- Focus session completion ratio
- Resource attachment usage rate
- Chronicle planning adherence
- Retention trend over rolling windows

## 27. Risks and Mitigations

### Risk: Feature coupling regressions
Mitigation:
- Keep route ownership explicit
- Add integration checks for module boundaries

### Risk: Deploy tooling drift
Mitigation:
- Validate CLI flags periodically
- Keep fallback manual deploy steps documented

### Risk: Large graph usability degradation
Mitigation:
- Maintain fit-to-frame behavior
- Add future clustering/Lod roadmap items

## 28. Practical Handoff Notes
If a new developer joins:
1. Start with this file.
2. Read long-form archive and deployment playbook.
3. Run local build and smoke validations.
4. Verify Graph behavior in production-like setup.

## 29. Summary Statement
Project Summary V2 captures Memora as a cohesive learning system with:
- Multi-module workflow continuity
- Strong UX iteration in Graph controls
- Improved operational reliability
- Scalable direction for future growth

The project is in a strong state for incremental evolution, provided continuity documentation, deployment discipline, and regression checks are maintained.
