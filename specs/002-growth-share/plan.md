# Implementation Plan: Growth & Social ScoreCard Share

**Feature Identifier**: `specs/002-growth-share`  
**Spec Reference**: [`specs/002-growth-share/spec.md`](file:///home/hasashi/Bureau/SLEEPMAXX/specs/002-growth-share/spec.md)  
**Research Reference**: [`specs/002-growth-share/research.md`](file:///home/hasashi/Bureau/SLEEPMAXX/specs/002-growth-share/research.md)  
**Date**: 2026-09-18  

---

## 1. Summary

Implements the zero-dependency social sharing pipeline for the Sleepmaxx score result. Isolates the visual `<ScoreCard />` from application controls in `ResultScreen`, introduces a lightweight native Canvas 2D image generator producing a standardized 9:16 vertical PNG asset ($1080 \times 1920\text{ px}$), orchestrates the Web Share API (`navigator.share` with `File`) with a defensive 4-tier fallback (Web Share File $\rightarrow$ Web Share Text + Download $\rightarrow$ Direct Download $\rightarrow$ Clipboard Text Copy), and provides an accessible "Share Score" button with transient feedback.

---

## 2. Technical Context

* **Language / Platform**: TypeScript 6.0 (Strict mode, zero `any`), React 19, Native HTML5 Canvas 2D.
* **External Dependencies Added**: **0** (Zero npm packages).
* **Target Output**: $1080 \times 1920\text{ px}$ PNG Blob (`image/png`), ratio 9:16.
* **Supported APIs**: Web Share API Level 2 (`navigator.canShare`, `navigator.share`), Clipboard API (`navigator.clipboard.writeText`), Canvas 2D API (`canvas.toBlob`).
* **Performance Budget**: Image generation $< 25\text{ms}$; execution within transient user gesture.
* **Testing Stack**: Vitest 4.1.11 with Node/jsdom canvas context mocks.

---

## 3. Constitution & PRD Governance Check

1. **Source of Truth Supremacy**: PASSED. Adheres directly to `docs/PRD.md` Section 9, 11.1, 15, and 16.3.
2. **Pure Scoring Engine Untouched**: PASSED. Zero lines modified in `src/core/scoringEngine.ts` or `SCORING_SPEC.md`.
3. **Zero-Budget & Local-First**: PASSED. 100% on-device client execution; zero server or external API costs.
4. **Zero Unnecessary Dependencies**: PASSED. Pure native Canvas 2D API; zero npm packages added.
5. **Non-Medical Wellness Positioning**: PASSED. Disclaimers preserved verbatim on both UI and exported image asset.

---

## 4. Architecture & Component Blueprint

```mermaid
flowchart TD
    A[User taps 'Share Score'] --> B[ResultScreen: handleShare]
    B --> C[Set UI state: loading / aria-busy]
    C --> D[generateScoreCardImage - Pure Canvas 2D]
    D -->|Promise Blob 1080x1920 PNG| E{navigator.canShare with files?}
    E -->|YES| F[navigator.share with File]
    F -->|User completed share| G[Reset UI state: idle]
    F -->|AbortError - user cancelled| G
    F -->|Other share error| H[Fallback: triggerDownload + copyClipboard]
    E -->|NO| I{navigator.share text only?}
    I -->|YES| J[navigator.share text & url + triggerDownload]
    I -->|NO / Desktop| H
    H --> K[Show feedback: Image downloaded & Link copied]
    K -->|2000ms delay| G
```

### 4.1 Component Refactoring & Capture Boundary Isolation
* **Current State**: `ScoreCard.tsx` renders both the visual score content and the `<button>Retake Quiz</button>` inside `.scorecard-container`.
* **Refactored Architecture**:
  * `ScoreCard.tsx` becomes a pure visual representation of the scorecard (watermark, score hero, archetype badge, weakness callout, breakdown bars, legal notice).
  * `ResultScreen.tsx` renders `<ScoreCard result={result} />` as the visual card surface, and renders the application action controls in a separate container below:
    * Primary Action: `<button className="share-score-btn">Share Score</button>`
    * Secondary Action: `<button className="retake-quiz-btn" onClick={onRetake}>Retake Quiz</button>`
    * Feedback Live Region: `<div role="status" aria-live="polite">` for transient clipboard/download notices.

### 4.2 Canvas 2D Engine (`src/features/quiz/utils/generateScoreCardImage.ts`)
* Pure function: `generateScoreCardImage(result: SleepmaxxResult): Promise<Blob>`
* Direct drawing specifications:
  * Width: $1080\text{px}$, Height: $1920\text{px}$.
  * Background: Solid deep dark `#0B0F17` with radial gradient glow.
  * Header Watermark: `SLEEPMAXX ROUTINE ENGINE` (0.8em tracking) + `sleepmaxx.app`.
  * Score Hero: Giant numeric score in tier color (Emerald `#10B981` $\ge 75$, Amber `#F59E0B` $60-74$, Rose `#EF4444` $<60$).
  * Archetype Pill: Rounded rectangle pill with uppercase archetype label (`COOKED`, `ZOMBIE`, `RECOVERING`, `SLEEPMAXXED`, `ELITE`).
  * Weakness Box: Deducted points highlight (`Biggest Weakness: [Category] (-X pts)`).
  * Category Breakdown: 5 progress bars with earned points and labels.
  * Footer: `"Can you reach 90 in 7 days? Take the free routine quiz on sleepmaxx.app"` + Non-Medical Wellness Notice.

### 4.3 Share Orchestrator (`src/features/quiz/utils/shareScore.ts`)
* Pure functional service: `shareSleepmaxxScore(result: SleepmaxxResult, options?: ShareOptions): Promise<ShareResult>`
* Cascade steps:
  1. `Level 1`: If `navigator.canShare && navigator.canShare({ files: [file] })`, call `navigator.share({ title, text, url, files: [file] })`.
  2. `Level 2`: If `navigator.share` is available without files, trigger `navigator.share({ title, text, url })` AND `triggerImageDownload(blob)`.
  3. `Level 3 & 4 (Desktop / Fallback)`: Execute `triggerImageDownload(blob)` and `navigator.clipboard.writeText(shareTextWithUrl)`.
  4. `Abort Handling`: If caught error has `err.name === 'AbortError'`, treat as success (`{ status: 'aborted' }`).

---

## 5. File System & Module Layout

```text
src/features/quiz/
├── components/
│   ├── ScoreCard.tsx             # PURE visual scorecard (removes interactive Retake button)
│   ├── ScoreCard.test.tsx        # Tests updated for pure visual boundary
│   ├── ResultScreen.tsx          # Renders ScoreCard + Share Score CTA + Retake CTA + feedback
│   └── ...
├── utils/
│   ├── generateScoreCardImage.ts # Pure Canvas 2D 1080x1920 PNG generator
│   ├── generateScoreCardImage.test.ts # Canvas mock unit tests
│   ├── shareScore.ts             # 4-level share orchestrator & fallback logic
│   └── shareScore.test.ts        # Unit tests for Web Share, Abort, Download, Clipboard
└── types.ts                      # ShareStatus & ShareResult types
```

---

## 6. Risk Mitigation & Verification Strategy

1. **Canvas in Vitest (jsdom)**: jsdom does not implement native Canvas 2D by default. In tests, we mock `document.createElement('canvas')` with a lightweight 2D context stub that simulates `toBlob` returning an `image/png` Blob, ensuring tests run in $<50\text{ms}$ with zero native binary bindings (`canvas` package).
2. **Gesture Expiration**: The synchronous Canvas drawing runs in memory in $<10\text{ms}$, guaranteeing the native `navigator.share()` call remains firmly within the browser's user activation window.
3. **Zero Regression**: All 165 existing tests must continue to pass untouched.
