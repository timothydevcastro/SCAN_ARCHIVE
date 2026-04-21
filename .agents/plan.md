# SCAN_ARCHIVE_V1.0 — Implementation Plan

**Project:** SCAN_ARCHIVE — AI Object Scanner  
**Phase:** 0 (Design Complete) → Phase 4 (Production-Ready)  
**Stack:** React 18 + TypeScript + Vite + Tailwind CSS + Google Gemini API  

---

## Milestone Map

```
Phase 0 — DONE       UI Shell Complete
Phase 1 — NEXT       Core API Integration (Text + Image)
Phase 2              History, State, Persistence
Phase 3              Export, Accessibility, Polish
Phase 4              Production Hardening
```

---

## Phase 1 — Core API Integration

**Goal:** A user can type any object, hit EXECUTE_SCAN, and receive a generated image + trivia data.

### Task 1.1 — Wire Environment Variable
- Confirm `.env` file has `GEMINI_API_KEY=your_key`
- Verify `vite.config.ts` `loadEnv` is correctly injecting it into `process.env.GEMINI_API_KEY`
- Add a startup check: if key is missing, render a persistent error banner instead of crashing silently

### Task 1.2 — Implement Text Generation Call
File: `src/App.tsx`

- Initialize `GoogleGenAI` client with the API key
- Call `ai.models.generateContent()` using model `gemini-2.0-flash`
- Pass system instruction with SCAN_ARCHIVE persona and output format expectations
- Set `responseMimeType: 'application/json'` and provide the full `responseSchema`
- Parse the JSON response and store in `currentScan` state
- On `isVague: true`, show the OBJECT UNCLEAR overlay immediately and stop

```typescript
// Pseudocode — Task 1.2
const textResponse = await ai.models.generateContent({
  model: 'gemini-2.0-flash',
  contents: `Scan target: ${query}`,
  config: {
    systemInstruction: SCAN_ARCHIVE_SYSTEM_PROMPT,
    responseMimeType: 'application/json',
    responseSchema: SCAN_DATA_SCHEMA,
  }
});
const data: ScanData = JSON.parse(textResponse.text!);
```

**Acceptance Criteria:**
- Scanning "apple" returns populated `objectName`, `facts[5]`, `relatedScans[3]`
- Scanning "asdf" triggers `isVague: true` and shows OBJECT UNCLEAR overlay
- API errors display SYSTEM ERROR overlay in the viewport

### Task 1.3 — Implement Image Generation Call
File: `src/App.tsx`

- After text data is resolved, call image generation using `imagePrompt` from response
- Use model `gemini-2.0-flash-preview-image-generation`
- Extract `inlineData` from the first candidate part where `part.inlineData` exists
- Build a data URI: `` `data:${mimeType};base64,${part.inlineData.data}` ``
- Assign to `data.imageUrl`
- If image generation throws or returns no `inlineData`, **continue without image** — do not block the scan

```typescript
// Pseudocode — Task 1.3
const imageResponse = await ai.models.generateContent({
  model: 'gemini-2.0-flash-preview-image-generation',
  contents: [{ parts: [{ text: data.imagePrompt }] }],
});
const imagePart = imageResponse.candidates?.[0]?.content?.parts
  ?.find(p => p.inlineData);
if (imagePart?.inlineData) {
  data.imageUrl = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
}
```

**Acceptance Criteria:**
- Scanning "golden retriever" shows a photorealistic image in the viewport
- Scanning still succeeds and shows data even if image generation fails
- Detection box overlay and label chip appear on top of the image

### Task 1.4 — Loading State UX
- Set `loading = true` before any API calls, `false` in `finally`
- Show the spinner with "ACQUIRING TARGET..." during text generation
- Optionally show a secondary state "RENDERING IMAGE..." between text and image calls
- Disable the submit button and input field while loading

### Task 1.5 — Error Handling
- Wrap both API calls in `try/catch`
- Set `error` state with a user-readable message
- Display error message inside the SYSTEM ERROR overlay in the scanning viewport
- Clear error on next scan attempt

---

## Phase 2 — History, State & Persistence

**Goal:** Scan history is fully functional, clickable, and survives page reload.

### Task 2.1 — Populate History on Each Scan
- After a successful scan (non-vague), append a new `HistoryItem` to the `history` array
- `HistoryItem` includes: `id` (Date.now()), `query`, `timestamp` (formatted), and a copy of `data`
- Prepend to array (newest first)

### Task 2.2 — Clickable History Items
- Clicking a history item in the sidebar calls `setCurrentScan(item.data)`
- The viewport loads the stored `imageUrl` and the trivia panel updates
- The active history item gets a visual highlight (inverted bg)

### Task 2.3 — Persist History to localStorage
```typescript
// On mount, restore history
useEffect(() => {
  const stored = localStorage.getItem('scan_history');
  if (stored) setHistory(JSON.parse(stored));
}, []);

// On history change, sync to localStorage
useEffect(() => {
  localStorage.setItem('scan_history', JSON.stringify(history));
}, [history]);
```
- Cap history at 50 items to avoid localStorage overflow (base64 images are large — consider storing text data only and re-generating images on click)
- **Alternative:** Store only text fields in localStorage, not `imageUrl`. Re-fetch image on history item click if needed.

### Task 2.4 — HISTORY Tab in Sidebar
- The HISTORY tab button in the left sidebar should be functional
- Clicking LIVE VIEW shows the scanning field
- Clicking HISTORY shows a full-panel history list (larger cards with classification preview)
- Use a `viewMode: 'live' | 'history'` state to toggle

### Task 2.5 — NEW_SCAN Button
- Already partially implemented: `setCurrentScan(null)` and `setInput('')`
- Also clear the `error` state
- Focus the input field after reset using `useRef`

---

## Phase 3 — Export, Accessibility & UI Polish

**Goal:** Export works, UI is accessible, animations are complete.

### Task 3.1 — EXPORT_PDF Button
Install: `npm install jspdf`

Build a structured PDF from `currentScan` data:
- Page header: "SCAN_ARCHIVE_V1.0 — EXPORT" with timestamp
- Section: SUBJECT ID, CONFIDENCE, CLASSIFICATION
- Section: FACT_01 through FACT_05
- Section: RELATED SCANS table
- Optional: embed the scanned image if `imageUrl` is present
- Style with monospace font and black borders to match the app aesthetic

```typescript
const handleExportPdf = () => {
  if (!currentScan) return;
  const doc = new jsPDF();
  doc.setFont('courier');
  doc.text(`SCAN_ARCHIVE_V1.0`, 10, 10);
  doc.text(`SUBJECT: ${currentScan.objectName}`, 10, 20);
  // ... build layout
  doc.save(`${currentScan.subjectId || 'scan'}.pdf`);
};
```

**Acceptance Criteria:**
- Clicking EXPORT_PDF generates and downloads a PDF with all scan data
- Button is disabled/dimmed when no scan is active

### Task 3.2 — LOG_ARCHIVE Button
- Exports entire session history as a JSON file
- Filename: `scan_archive_log_YYYY-MM-DD.json`
- Use `Blob` + `URL.createObjectURL` for client-side download

```typescript
const handleLogArchive = () => {
  const blob = new Blob([JSON.stringify(history, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `scan_log_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
};
```

### Task 3.3 — Animation Completeness
Using existing `motion/react`:
- **Image reveal:** scale from 0.95 to 1.0, fade in over 400ms
- **Trivia panel:** staggered children — each FACT block slides in with 80ms delay between them
- **History items:** new items animate in from the top (height expand + fade)
- **OBJECT UNCLEAR / SYSTEM ERROR:** shake animation on entry

### Task 3.4 — Mobile Polish
- On screens < 768px, the scan history sidebar becomes a collapsible drawer
- A hamburger/archive icon in the top bar opens/closes it
- The trivia panel stacks below the scanning field with a visible divider
- The input bar is sticky at the bottom of the viewport on mobile

### Task 3.5 — Accessibility
- All interactive elements have `aria-label` attributes
- The input has `aria-label="Scan target input"`
- Loading state announces to screen readers via `aria-live="polite"` region
- Keyboard navigation: Tab through input → button; Escape clears scan
- Sufficient color contrast is already met by the black-on-white palette

---

## Phase 4 — Production Hardening

**Goal:** App is safe, reliable, and deployable.

### Task 4.1 — API Key Security
For prototype/demo: client-side key is acceptable  
For production deployment:
- Move API calls to a backend proxy route (Next.js API routes, or a Cloudflare Worker)
- The frontend calls `/api/scan` with `{ query }`, the proxy calls Gemini server-side
- API key stays in server environment variables, never shipped to the browser

### Task 4.2 — Rate Limiting & Abuse Prevention
- Add a 2-second debounce on the EXECUTE_SCAN button
- Prevent duplicate scans of the same query within 10 seconds
- Show a friendly cooldown message: "SCANNER COOLING DOWN..."

### Task 4.3 — Image Storage Optimization
- Base64 images in localStorage are large (~500KB–2MB per image)
- Option A: Store only the `imagePrompt`, re-generate on history click
- Option B: Use `IndexedDB` (via `idb` library) for larger storage limits
- Option C: Upload to a free image host (Cloudinary free tier) and store URL only

### Task 4.4 — SEO & Meta
- Set `<title>` dynamically to reflect active scan: `"APPLE | SCAN_ARCHIVE"`
- Add Open Graph meta tags for sharing scans (if scan data is URL-addressable)

### Task 4.5 — Testing
- Unit tests for JSON schema parsing and edge cases (`isVague`, empty facts, missing imageUrl)
- Integration test for the full scan flow using a mocked Gemini client
- Manual test matrix: common objects, vague inputs, very long names, emoji inputs, non-English text

---

## File Structure (Target)

```
src/
├── App.tsx                  # Main component — scan state, API orchestration
├── main.tsx                 # Entry point
├── index.css                # Tailwind base
├── constants/
│   ├── prompts.ts           # SCAN_ARCHIVE system prompt string
│   └── schema.ts            # Gemini responseSchema definition
├── components/
│   ├── ScanViewport.tsx     # Middle column — camera field, image, overlays
│   ├── TriviaPanel.tsx      # Right column — facts, classification, export buttons
│   ├── HistorySidebar.tsx   # Left column — history list, tabs, new scan
│   └── LoadingOverlay.tsx   # Spinner + status text
├── hooks/
│   ├── useScanHistory.ts    # localStorage sync, history state
│   └── useGemini.ts         # API call logic abstracted into a hook
├── types/
│   └── scan.ts              # ScanData, HistoryItem interfaces
└── utils/
    ├── exportPdf.ts         # jsPDF export logic
    └── exportJson.ts        # JSON log download logic
```

---

## Priority Order (What to Build First)

| Priority | Task | Estimated Effort |
|---|---|---|
| P0 | Task 1.2 — Text generation API call | 2–3 hours |
| P0 | Task 1.3 — Image generation call | 1–2 hours |
| P0 | Task 1.4 — Loading states | 1 hour |
| P0 | Task 1.5 — Error handling | 1 hour |
| P1 | Task 2.1 — History population | 1 hour |
| P1 | Task 2.2 — Clickable history items | 1 hour |
| P1 | Task 2.5 — NEW_SCAN cleanup | 30 min |
| P2 | Task 2.3 — localStorage persistence | 1 hour |
| P2 | Task 3.1 — PDF export | 2–3 hours |
| P2 | Task 3.2 — JSON log export | 30 min |
| P3 | Task 3.3 — Animation polish | 1–2 hours |
| P3 | Task 3.4 — Mobile polish | 2–3 hours |
| P4 | Task 4.1 — API proxy | 3–4 hours |
| P4 | Task 4.3 — Image storage optimization | 2–3 hours |

**Total estimated effort to P2 completion: ~14–18 hours**

---

## Definition of Done

A scan is considered fully functional when:
1. User types a query and presses EXECUTE_SCAN
2. Loading animation plays while both API calls run
3. Generated image fills the scanning viewport with detection overlay
4. Trivia panel populates with objectName, classification, 5 facts, related scans
5. Scan is added to history sidebar
6. User can click history item to reload that scan
7. User can export the scan as a PDF
8. Error states are visible and recoverable without page refresh

---

*Document Version: 1.0 — Pre-Implementation Phase*
