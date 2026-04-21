# SCAN_ARCHIVE_V1.0 — Research Document

**Project Type:** AI-Powered Object Scanner & Knowledge Retrieval Interface  
**Stack:** React 18 + TypeScript + Vite + Tailwind CSS + Google Gemini API  
**Status:** Design Complete — Functional Integration Pending  

---

## 1. Project Overview

SCAN_ARCHIVE is an archival-aesthetic web application where users input any object, animal, place, food, or concept as a text query. The system responds with a generated image of that subject, structured factual data, and related scan history — all rendered inside a military/archival scanner UI.

The app is currently in a **UI-complete, logic-incomplete** state. The interface shell exists but the Gemini API calls, image generation pipeline, persistent history, and export features are not yet wired.

---

## 2. Current State Analysis

### What Exists
- Full three-column layout: Sidebar (history), Scanning Field (main viewport + input), Trivia Panel (facts + metadata)
- Crosshair, detection box, and scanner overlay UI
- Input form with `EXECUTE_SCAN` button
- Static LIVE VIEW / HISTORY tab UI
- NEW_SCAN button to reset
- Responsive layout for mobile and desktop
- Tailwind utility-first styling with a strict black-and-white brutalist aesthetic

### What Is Missing
- Gemini `generateContent` API call for structured text data (facts, classification, subjectId, etc.)
- Gemini image generation call using `gemini-2.5-flash-image` or equivalent model
- Actual scan history stored in state and rendered dynamically
- Clickable history items that reload a previous scan into the panel
- Functional EXPORT_PDF and LOG_ARCHIVE buttons
- Error state handling visible to the user
- Loading state animation during scan processing
- Mobile-responsive scan history sidebar behavior
- Environment variable wiring (`GEMINI_API_KEY` via `.env`)

---

## 3. Technology Research

### 3.1 Google Gemini API

**Text Generation (Structured Output)**  
Model: `gemini-2.0-flash` or `gemini-1.5-pro`  
Method: `ai.models.generateContent()` with `responseMimeType: 'application/json'` and `responseSchema`  
The schema forces a typed JSON response — no parsing fragility.

Key schema fields required:
- `isVague` (boolean) — determines if the query is too ambiguous to scan
- `objectName` (string) — uppercase canonical name
- `confidence` (string) — simulated percentage e.g. "97.4%"
- `subjectId` (string) — archive code e.g. "TB_001_OBJ"
- `classification` (string) — 2–3 sentence clinical description
- `imagePrompt` (string) — passed into image generation
- `facts` (array of 5 strings) — historical, surprising, scientific, cultural, weird
- `relatedScans` (array of 3 objects with `timestamp` and `objectName`)

**Image Generation**  
Model: `gemini-2.0-flash-preview-image-generation` (or `imagen-3.0-generate-002`)  
The response contains `inlineData` with base64 image payload.  
Fallback: if image generation fails, the scan still succeeds — display a placeholder pattern.

**API Key Handling**  
The Vite config exposes `GEMINI_API_KEY` via `process.env.GEMINI_API_KEY` using `loadEnv`.  
The `.env.example` confirms the key is user-supplied and not committed to source.  
Client-side key exposure is an accepted tradeoff for a prototyping/demo context.

### 3.2 State Management

No external state library (Redux, Zustand) is needed for this scope. React `useState` and `useRef` are sufficient:

- `currentScan: ScanData | null` — the active scan shown in the viewport and trivia panel
- `history: HistoryItem[]` — all completed scans this session (newest first)
- `loading: boolean` — controls spinner, disables submit
- `error: string | null` — shown as SYSTEM ERROR overlay in the viewport
- `input: string` — controlled text input value

For persistence across page reloads, `localStorage` can be used to persist `history`.

### 3.3 Image Rendering

The generated image arrives as a base64 data URI: `data:image/png;base64,...`  
This is assigned directly to `<img src={...} />` — no file upload or blob URL needed.  
The detection overlay (dashed border box + label chip) is absolutely positioned on top.

### 3.4 PDF Export

**Option A — `jspdf` + `html2canvas`:** Screenshots the trivia panel and exports to PDF. Simple but image-quality dependent.  
**Option B — `jspdf` with programmatic layout:** Builds a structured PDF from JSON data. Crisp and archival-appropriate.  
**Recommendation:** Use `jspdf` with programmatic layout to match the archival aesthetic.

### 3.5 Animation

`framer-motion` (as `motion/react`) is already in the codebase.  
Use `AnimatePresence` + `motion.div` for:
- Fade-in of the scanned image
- Slide-in of the trivia panel data
- Fade-out of the AWAITING TARGET state

### 3.6 Responsive Behavior

The layout uses `flex-col md:flex-row`. On mobile:
- The sidebar collapses to a top strip
- The middle column goes full-width
- The trivia panel stacks below

The scan history in the sidebar should be a horizontally scrollable strip on mobile.

---

## 4. API Response Schema (Reference)

```typescript
interface ScanData {
  isVague: boolean;
  objectName?: string;        // e.g. "GOLDEN_GATE_BRIDGE"
  confidence?: string;        // e.g. "98.3%"
  subjectId?: string;         // e.g. "GGB_042_OBJ"
  classification?: string;    // 2–3 sentence description
  imagePrompt?: string;       // Passed to image model
  facts?: string[];           // Exactly 5 items
  relatedScans?: {
    timestamp: string;        // e.g. "2024.03.15 09:41"
    objectName: string;       // e.g. "BROOKLYN_BRIDGE_07"
  }[];
  imageUrl?: string;          // Resolved after image generation
}
```

---

## 5. Identified Risk Areas

| Risk | Impact | Mitigation |
|---|---|---|
| Gemini image model quota/rate limit | Image fails to generate | Graceful fallback — show placeholder grid pattern |
| Vague or nonsensical queries | Poor UX, empty output | `isVague: true` branch shows "OBJECT UNCLEAR" overlay |
| API key exposed client-side | Security risk in production | Acceptable for prototype; proxy route needed for production |
| Long generation time (text + image) | Perceived slowness | Show incremental loading states; render text data first, then image |
| JSON parse failure from API | App crashes | Wrap in try/catch; display SYSTEM ERROR in viewport |
| Mobile layout overflow | Unusable on small screens | Use `min-w-0` + `overflow-hidden` on flex children |

---

## 6. External Dependencies

| Package | Purpose | Status |
|---|---|---|
| `@google/genai` | Gemini API client | Used in existing App.tsx |
| `motion/react` (framer-motion) | Animations | Used in existing App.tsx |
| `lucide-react` | Icons (Maximize, Settings, Camera, etc.) | Used in existing App.tsx |
| `tailwindcss` (via Vite plugin) | Utility CSS | Configured in vite.config.ts |
| `jspdf` | PDF export | To be installed |
| `html2canvas` | Optional — DOM screenshot for PDF | To be installed if needed |

---

## 7. Competitive / Reference Analysis

**Pokedex-style apps** — similar scan-and-reveal pattern. Key UX lesson: the reveal animation is as important as the data itself.  
**Google Lens** — real-time object identification. SCAN_ARCHIVE is a deliberate text-first alternative with richer contextual data.  
**Wikipedia / Wolfram Alpha** — data richness. SCAN_ARCHIVE differentiates through presentation: archival, clinical, aesthetic.  
**ScannerDarkly UI trend** — brutalist monochrome UIs with high contrast. Growing design trend in developer and tech-adjacent tools.

---

*Document Version: 1.0 — Pre-Implementation Phase*
