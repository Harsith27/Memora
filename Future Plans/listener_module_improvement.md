# Future Plan: Listener Module Enhancements & Troubleshooting

This document details the analysis, diagnostic findings, and structural plans to address the issues in the **Listener** module.

---

## 1. Why is the Listener Module in Memora?

Memora is a comprehensive cognitive retention and spaced repetition platform. The **Listener** module plays a vital role by bridging the gap between passive listening (e.g., lectures, brainstorming, verbal explanations) and active recall:

* **Voice-to-Active-Recall Pipeline:** Instead of typing out study notes manually, users can record lectures, seminars, or their own verbal explanations. The system transcribes and distills the spoken text into structured study notes.
* **Brainstorming & Concept Integration:** Spoken ideas are transcribed, parsed, and can be directly exported to **Mindmaps** or linked to topics for **Spaced Repetition** queues.
* **Low Cognitive Friction:** Dictating revision notes makes it easier to capture study insights on the go.

---

## 2. Diagnosis: Finalize Button / Groq API Failures

When users click the "Finalize" button, the frontend sends the recorded audio to `POST /api/listener/process`. This endpoint fails with a generic error because:

### Key Issue: Revoked Groq API Keys (HTTP 403 Forbidden)
Using our `check_groq.py` tool, we tested the API keys configured in `memora-backend/.env`:
* `GROQ_API_KEY1`, `GROQ_API_KEY2`, and `GROQ_API_KEY3` all return **HTTP 403 Forbidden**.
* The commented-out fallback `GROQ_API_KEY` also returns **HTTP 403 Forbidden**.
Because Groq has invalidated these credentials, any backend transcription or summarization request throws a raw exception, failing the process.

### Secondary Vulnerability: Lack of LLM Fallback Routing
* The backend listener router does not have a fallback LLM chain. If Groq is down or the keys are invalid, it throws a generic 500 error instead of falling back to other providers (such as Gemini or OpenAI) or running a local mock transcription.

---

## 3. Plan of Action (What to Rectify & Add)

### Phase 1: Authentication & Key Health checks (High Priority)
* **API Key Update:** Replace the invalid Groq keys in `memora-backend/.env` with fresh, active API credentials.
* **Pre-Flight Key Check:** Implement a server startup check in `server.js` to validate API key health with a single lightweight query `/v1/models` so errors are caught at startup rather than during user interaction.

### Phase 2: Multi-Provider LLM Fallback
* Integrate a fallback chain in `memora-backend/routes/listener.js`:
  1. **Primary:** Groq Whisper (`whisper-large-v3-turbo`) & Llama-3 (`llama-3.3-70b-versatile`).
  2. **Secondary:** Google Gemini API (supporting audio-to-text natively or via text-based completions if pre-transcribed).
  3. **Local Mock Mode:** If all keys fail or the user is offline, provide a local mock generator that uses a rule-based parser or regex-extractor to structure a summary from whatever text can be salvaged, or prompt the user to manually enter the text.

### Phase 3: UX & Audio Resilience
* **MIME-Type Fallbacks:** Explicitly detect unsupported audio codecs in the browser and fallback to generic wave formats.
* **Mic Permission Toast:** If microphone permission is blocked by browser security, intercept the error and display an actionable alert guiding the user to browser site settings.
* **Progressive Upload States:** For long recordings (approaching the 25MB limit), display an upload progress percentage and processing stage indicators (`Transcribing audio...`, `Summarizing note...`, `Saving note...`).
* **Note Format Customization:** Add a selection toggle in Settings (e.g., "Bullet Points", "Q&A Flashcards", "Summary Paragraphs") to let the user customize the formatting prompts passed to the summarization model.

---

## 4. Verification Plan

### Automated Tests
* Add a mock integration test in `memora-backend/tests/listener.test.js` to assert that:
  - Staged API key rotations function correctly under rate limits.
  - The fallback mechanism redirects calls to secondary providers when primary requests time out.
