# Architectural, Design, and UX Suggestions

This document presents technical proposals, design adjustments, and algorithm enhancements to improve the scalability, efficiency, and design of the Memora platform.

---

## 1. Algorithmic Enhancement: Personalized Spaced Repetition via Cognitive Scaling

### The Idea
The application currently runs a cognitive baseline evaluation (MemScore) and uses a static SuperMemo SM-2 algorithm to adjust intervals. However, the `memScore` is not dynamically integrated into the ease factor or interval calculations of daily reviews.

### Proposal
Modify the backend topic spacing calculation in `memora-backend/routes/topics.js` to dynamically scale review intervals according to the user's specific `memScore`.

```javascript
// Scale the interval using a cognitive coefficient based on the user's latest MemScore
function calculateCognitivelyScaledInterval(baseInterval, easeFactor, memScore) {
  // memScore represents baseline retention capability (0 - 100)
  // Shift scale so score of 70 represents standard 1.0 multiplier
  const cognitiveScale = 0.7 + (memScore / 100) * 0.4; // Ranges from 0.7x to 1.1x
  
  return Math.round(baseInterval * easeFactor * cognitiveScale);
}
```

### Visual Dashboard Feedback
Display a "Cognitive Spacing Factor" gauge on the user profile or topic cards to show how their evaluation performance has customized their review timeline.

---

## 2. Advanced Spaced Repetition Analytics

### 2.1 Spaced Repetition Workload Forecast Chart
* **UI Location:** Analytics dashboard ([Analytics.jsx](file:///c:/Harsith_Dev/Memora/memora-frontend/src/pages/Analytics.jsx))
* **Proposal:** Use `recharts` to render a bar chart depicting "Workload Forecast" for the upcoming 7, 15, and 30 days. This aggregates the count of topics due for review based on their scheduled `nextReviewDate`.
* **Value:** Helps users anticipate heavy study loads (e.g., if multiple high-difficulty topics fall on the same day) and use the "Prevent Crowding" load balancing feature preemptively.

### 2.2 GitHub-Style Commitment Heatmap
* **UI Location:** Dashboard page ([Dashboard.jsx](file:///c:/Harsith_Dev/Memora/memora-frontend/src/pages/Dashboard.jsx))
* **Proposal:** Build a custom CSS grid representing a 1-year history grid of daily topic reviews.
  - Cells are colored dynamically from dark grey (0 reviews) to bright neon green/cyber blue (10+ reviews).
  - Tapping a block shows a pop-up listing topics revised on that day.
* **Value:** Drives consistency through visualization, aligning with the "cyber-grid" theme.

---

## 3. Aesthetic Improvements: Interactive Cyber-Grid Interactions

The platform's custom theme (dark mode, sharp corners, radial gradients) can be made even more immersive.

### 3.1 Dynamic Mouse-Interact Cyber Grid
* **Code Location:** [CyberGrid.jsx](file:///c:/Harsith_Dev/Memora/memora-frontend/src/components/CyberGrid.jsx)
* **Proposal:** Update the background mesh. The intersection nodes in the background grid should dynamically light up as the cursor passes nearby, with lines fading out radially from the mouse position.
* **Implementation:** Use HTML Canvas in `CyberGrid.jsx` to trace mouse movements and draw light-weight radial grids.

### 3.2 Retro Technical CLI Loading Sequences
* **UI Location:** Main App loading screens ([App.jsx](file:///c:/Harsith_Dev/Memora/memora-frontend/src/App.jsx#L96-L102))
* **Proposal:** Replace generic "Loading..." text with rapid diagnostic outputs, resembling a server terminal booting up.
  ```text
  [neuro-engine] CALIBRATING COGNITIVE BASELINE...
  [db] CONNECTING TO MONGO ATLAS REGION...
  [session] JWT ACCESS GRANTED.
  [ui] INJECTING NEON MATRIX...
  ```
  This enhances the futuristic vibe before loading the dashboard.

---

## 4. High-Availability: Multi-Provider LLM Fallback (Groq and Gemini)

### Location
* **Backend Router:** [mindmaps.js](file:///c:/Harsith_Dev/Memora/memora-backend/routes/mindmaps.js)

### The Issue
AI-driven mindmap generation uses Groq via the Llama-3 model. Because the project is deployed to a public URL with shared traffic, the Groq API key is highly susceptible to rate limits (`429 Too Many Requests`) or service outages.

### Proposal
Configure a chain of fallback models in the backend. If the primary LLM call fails, the router should automatically switch to a secondary LLM provider.

```javascript
async function generateMindmapWithFallback(prompt, keys) {
  try {
    // Attempt 1: Call Groq API
    return await generateWithGroq(prompt, keys.groq);
  } catch (groqError) {
    console.warn("Groq generation failed. Falling back to Gemini...", groqError);
    try {
      // Attempt 2: Fallback to Google Gemini
      return await generateWithGemini(prompt, keys.gemini);
    } catch (geminiError) {
      console.error("All AI providers exhausted. Falling back to rule-based parser.");
      // Attempt 3: Local fallback parsing
      return generateStaticConceptMindmap(prompt);
    }
  }
}
```

---

## 5. Performance: Manual Rollup Chunk Splitting for Large Vendor Bundles

### Location
* **Frontend Config:** [vite.config.js](file:///c:/Harsith_Dev/Memora/memora-frontend/vite.config.js)

### The Issue
Vite displays warning messages during build stating that several JavaScript chunks (primarily containing Recharts and pdfjs-dist) exceed the recommended 500KB limit, causing longer page load times on initial site visits.

### Proposal
Modify the output configuration of the bundler to split heavy, specialized libraries into their own files. This allows the browser to cache vendor packages once and download only page source code on updates:

```javascript
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('recharts')) return 'vendor-charts';
            if (id.includes('pdfjs-dist')) return 'vendor-pdf';
            if (id.includes('framer-motion')) return 'vendor-animations';
            return 'vendor-core';
          }
        }
      }
    }
  }
});
```
This reduces the initial bundle payload significantly.
