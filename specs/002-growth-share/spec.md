# Feature Specification: Growth & Social ScoreCard Share

**Feature Identifier**: `specs/002-growth-share`  
**Created**: 2026-09-18  
**Status**: Complete / Validated  

---

## 1. Executive Summary & Purpose

This specification defines the viral acquisition loop for **Sleepmaxx** as mandated by `docs/PRD.md` Section 9, 11.1, and 16:
```
User takes quiz 
  → Receives deterministic score & archetype
  → Taps native <button type="button"> "Share Score" on Result Screen
  → Client-side engine renders a calibrated 9:16 vertical PNG card (1080×1920) in memory
  → Path A: If Web Share Level 2 with files is supported:
       Opens native mobile share sheet (Instagram Stories, TikTok, WhatsApp, Save Image)
  → Path B: If native file share is unsupported or fails technically:
       Directly downloads sleepmaxx-score.png and copies companion share text/link to clipboard
  → If user cancels native share (AbortError):
       Clean silent return to idle state (zero downloads, zero clipboard writes, zero alerts)
  → Shared card displays score, archetype, leak, and "sleepmaxx.app" watermark
  → Social viewers discover the app via bio link / watermark
```

**Core Principle**: The share experience must remain 100% client-side, zero-cost, zero-backend, zero-dependency, and fully functional offline in PWA mode.

---

## 2. Source-of-Truth Traceability

| PRD Section | Requirement | Spec Item |
| :--- | :--- | :--- |
| **PRD §2.1 & §9** | Viral loop: Shareable Output Asset driving organic discovery | FR-SHARE-001 |
| **PRD §11.1** | Downloadable / shareable branded scorecard on the free result screen | FR-SHARE-002 |
| **PRD §15** | Screenshot optimization: high-density, vertical visual asset (9:16 or 4:5 ratio) | FR-SHARE-003 |
| **PRD §16.2** | Viral mechanics: Polarizing score sharing with watermark | FR-SHARE-004 |
| **PRD §16.3** | Native Sharing: Support `navigator.share` on mobile with seamless download fallback | FR-SHARE-005 |
| **PRD §16.3** | Clean branded watermark (`sleepmaxx.app` / link) on scorecard asset | FR-SHARE-006 |
| **Constitution §IV** | Zero-budget & local-first (no server image generation, zero external API costs) | CR-SHARE-001 |
| **Constitution §V** | Non-medical wellness positioning (notice on exported asset) | CR-SHARE-002 |

---

## 3. User Scenarios & Acceptance Criteria

### User Scenario 1: Native Mobile Share via Instagram / TikTok Stories (Priority: P1)
A Gen-Z user completes the quiz on mobile Safari (iOS) or mobile Chrome (Android), sees their "72 / RECOVERING" score, and taps "Share Score". The app generates a crisp 9:16 story asset in memory and triggers the native OS share sheet. The user selects Instagram Stories or saves the image to their camera roll without leaving the app.

* **Acceptance Criteria**:
  1. On `ResultScreen`, a native `<button type="button">` labeled "Share Score" is rendered as a primary action above "Retake Quiz".
  2. Tapping "Share Score" compiles the active `SleepmaxxResult` into a PNG image asset directly in memory, targeting minimal latency to preserve the active user gesture.
  3. When `navigator.share` and `navigator.canShare({ files: [file] })` return true, `navigator.share` is invoked with the PNG `File` object, title, and formatted summary text.
  4. If the user dismisses or cancels the native sheet (`AbortError`), the app resets cleanly to idle state with zero error alerts, zero automatic downloads, and zero clipboard modifications.

### User Scenario 2: Desktop & Unsupported Browser Fallback (Priority: P1)
A user completes the quiz on a desktop browser (or any environment lacking Web Share Level 2 file sharing). Tapping "Share Score" triggers the explicit fallback: the calibrated PNG image is downloaded directly (`sleepmaxx-score.png`), and the companion promotional text with link is copied to their clipboard, with clear and separate accessibility announcements.

* **Acceptance Criteria**:
  1. When native file sharing is unsupported or unavailable, the application initiates an automatic download of `sleepmaxx-score.png` via programmatic link trigger.
  2. The application copies the companion text and URL to the clipboard via `navigator.clipboard.writeText`.
  3. A temporary feedback banner and screen reader live region announce: "ScoreCard image downloaded. Share link copied to clipboard." (explicitly distinguishing file download from text copying).
  4. If clipboard write fails (e.g., focus lost or permissions denied), the image download still succeeds without throwing an unhandled exception.

### User Scenario 3: Technical Error Handling vs User Abort (Priority: P1)
During a share attempt, an unexpected technical error occurs (e.g. browser gesture timeout `NotAllowedError` or canvas export failure).

* **Acceptance Criteria**:
  1. If `navigator.share` rejects with a technical error (non-`AbortError`), the system logs the error and attempts the explicit image download fallback.
  2. If image generation itself fails, the app announces a clear recovery message via `aria-live`: "Unable to generate scorecard image. Please take a screenshot." and resets cleanly to idle.

### User Scenario 4: Capture Boundary Isolation (Priority: P1)
A user inspects the exported PNG image. The image contains strictly the visual score presentation (watermark, score, archetype, weakness, category breakdown, disclaimer). Application control buttons ("Share Score", "Retake Quiz") are strictly excluded from the exported asset.

* **Acceptance Criteria**:
  1. Zero UI control buttons appear in the generated image asset.
  2. Interactive buttons in `ResultScreen` remain fully accessible to keyboard navigation and screen readers.

---

## 4. Functional Requirements

* **FR-SHARE-001 (Share Trigger Contract)**: `ResultScreen` MUST provide a primary CTA button implemented as a native HTML `<button type="button">` labeled "Share Score". It MUST have a minimum touch target $\ge 52\text{px}$, visible keyboard focus styling, `disabled` state during processing, and MUST NOT specify a redundant `role="button"`.
* **FR-SHARE-002 (Asset Specification)**: The generated asset MUST be a PNG image formatted at standard 9:16 vertical resolution ($1080 \times 1920\text{ px}$) with deep dark background (`#0B0F17`), high-contrast typography, and tier-colored glowing accents.
* **FR-SHARE-003 (Watermark & Link)**: The exported asset MUST include the prominent domain watermark `sleepmaxx.app` and tagline `"Can you reach 90 in 7 days?"`.
* **FR-SHARE-004 (Native Web Share with File)**: The share workflow MUST verify `navigator.share && navigator.canShare && navigator.canShare({ files: [file] })`. If true, it MUST invoke `navigator.share` passing a valid `File` object (`name: 'sleepmaxx-score.png'`, `type: 'image/png'`).
* **FR-SHARE-005 (AbortError Isolation)**: A user dismissing the native share dialog (`error.name === 'AbortError'`) MUST result in an immediate, silent reset to `idle`. It MUST NOT trigger an automatic download, MUST NOT copy to clipboard, and MUST NOT display any error message.
* **FR-SHARE-006 (Explicit Download Fallback)**: When native file sharing is unavailable or fails technically, the application MUST trigger a direct programmatic download of `sleepmaxx-score.png`.
* **FR-SHARE-007 (Companion Clipboard Text Copy)**: When download fallback is triggered on desktop / non-file-sharing platforms, the application MUST attempt to copy promotional text and URL via `navigator.clipboard.writeText`. Under no circumstances may this be described to the user as copying the image.
* **FR-SHARE-008 (Rejection of Text-Only Web Share Fallback)**: Automated fallback to text-only `navigator.share({ text, url })` without the image file is explicitly omitted because it suppresses the visual scorecard asset (the core viral deliverable) and conflicts with simultaneous file downloads on mobile operating systems.
* **FR-SHARE-009 (Capture Boundary)**: Application controls (`Share Score`, `Retake Quiz`) MUST be rendered as sibling elements outside the visual card surface.
* **FR-SHARE-010 (Zero Scoring Engine Drift)**: The share feature MUST consume `SleepmaxxResult` strictly as read-only data. Scoring weights, formulas, archetypes, and sanitizers in `src/core/` are immutable.

---

## 5. Non-Functional & Architectural Constraints

* **CR-SHARE-001 (Zero Dependencies)**: No third-party rendering libraries (`html2canvas`, `html-to-image`, `dom-to-image`) may be installed. Asset generation must use native client-side HTML5 Canvas 2D API.
* **CR-SHARE-002 (Transient User Activation & Performance Target)**: Asset generation is designed to run synchronously or near-instantaneously in memory without DOM layout passes. The validation target is ensuring generation completes rapidly enough to keep `navigator.share` inside the active user activation window, preventing `NotAllowedError`.
* **CR-SHARE-003 (Local-First & Offline)**: All generation, downloading, and sharing logic must function without an active internet connection once PWA assets are cached.
* **CR-SHARE-004 (Accessibility & ARIA Standards)**:
  * Primary button: Native `<button type="button">` without redundant `role="button"`.
  * Keyboard navigation: Fully operable via Tab, Enter, and Space keys with `:focus-visible` styling.
  * State management: `disabled={isSharing}` and `aria-busy={isSharing}` during active rendering.
  * Feedback: A sibling live region `<div role="status" aria-live="polite">` MUST announce operation status to assistive technologies.

---

## 6. Scope Boundaries & Exclusions

The following features are **explicitly excluded** from this specification:
* No server-side rendering (SSR) or Node-canvas microservice.
* No direct TikTok or Instagram Graph API OAuth integration (sharing relies strictly on the native OS share sheet).
* No image hosting, cloud uploads (S3/Cloudinary), or shortened URL redirects.
* No analytics tracking SDKs or share event telemetry.
* No payment gates or protocol paywalls.
