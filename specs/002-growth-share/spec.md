# Feature Specification: Growth & Social ScoreCard Share

**Feature Identifier**: `specs/002-growth-share`  
**Created**: 2026-09-18  
**Status**: Specification Complete — Ready for Implementation  

---

## 1. Executive Summary & Purpose

This specification defines the viral acquisition loop for **Sleepmaxx** as mandated by `docs/PRD.md` Section 9, 11.1, and 16:
```
User takes quiz 
  → Receives deterministic score & archetype
  → Taps "Share Score" on Result Screen
  → Client-side engine generates a calibrated 9:16 vertical PNG card (1080×1920)
  → Web Share API opens native mobile share sheet (TikTok, Instagram Stories, WhatsApp, Save Image)
  → Fallback downloads PNG and copies share text/link to clipboard
  → Shared card displays score, archetype, leak, and "sleepmaxx.app" watermark
  → Viewers on social platforms discover the app via bio link / watermark
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
A Gen-Z user completes the quiz on mobile Safari (iOS) or mobile Chrome (Android), sees their "72 / RECOVERING" score, and taps "Share Score". The app instantly packages a crisp 9:16 story asset and triggers the native OS share sheet. The user selects Instagram Stories or saves the image to their camera roll without leaving the app.

* **Acceptance Criteria**:
  1. On `ResultScreen`, a prominent "Share Score" button is rendered above "Retake Quiz".
  2. Tapping "Share Score" compiles the active `SleepmaxxResult` into a PNG image asset within `<50ms`.
  3. When `navigator.canShare({ files })` is supported, `navigator.share` is invoked with the PNG `File` object, title, and pre-formatted text containing the score, archetype, and `sleepmaxx.app`.
  4. If the user dismisses the native sheet (`AbortError`), the app resets cleanly to idle state without error alerts.

### User Scenario 2: Desktop & Unsupported Browser Fallback (Priority: P1)
A student completes the quiz on desktop Firefox or Chrome. Tapping "Share Score" triggers a dual fallback: the calibrated PNG image is automatically downloaded to their computer (`sleepmaxx-score.png`), and the promotional share text with link is copied to their clipboard with visible feedback ("Link copied to clipboard!").

* **Acceptance Criteria**:
  1. When Web Share is unsupported or file sharing fails, the app automatically triggers a download of `sleepmaxx-score.png`.
  2. The app writes the promotional text and link to the clipboard via `navigator.clipboard.writeText`.
  3. A temporary feedback banner/toast confirms: "Image downloaded & link copied!".

### User Scenario 3: Capture Boundary Isolation (Priority: P1)
A user inspects the exported PNG image. The image contains only the visual score presentation (watermark, score, archetype, weakness, category breakdown, disclaimer). The action buttons ("Share Score", "Retake Quiz") are strictly excluded from the exported asset.

* **Acceptance Criteria**:
  1. Zero UI control buttons appear in the generated image.
  2. The interactive buttons in `ResultScreen` remain fully accessible to screen readers and keyboard navigation.

---

## 4. Functional Requirements

* **FR-SHARE-001 (Share Trigger)**: `ResultScreen` MUST provide a dedicated primary CTA button labeled "Share Score" (touch target $\ge 52\text{px}$).
* **FR-SHARE-002 (Asset Specification)**: The generated asset MUST be a PNG image formatted at standard 9:16 vertical resolution ($1080 \times 1920\text{ px}$) with deep dark background (`#0B0F17`), high-contrast typography, and tier-colored glowing accents.
* **FR-SHARE-003 (Watermark & Link)**: The exported asset MUST include the prominent domain watermark `sleepmaxx.app` and tagline `"Can you reach 90 in 7 days?"`.
* **FR-SHARE-004 (Native Web Share)**: The share workflow MUST evaluate `navigator.canShare({ files: [file] })`. If truthy, it MUST pass a `File` object (`name: 'sleepmaxx-score.png'`, `type: 'image/png'`).
* **FR-SHARE-005 (Graceful Abort Handling)**: A user closing the native share dialog without selecting a target MUST be handled transparently (ignoring `AbortError`) without showing failure states.
* **FR-SHARE-006 (Download Fallback)**: If file sharing is unsupported or fails, the application MUST automatically download `sleepmaxx-score.png` via programmatic link trigger and `URL.createObjectURL`.
* **FR-SHARE-007 (Clipboard Fallback)**: On desktop or when native sharing is unavailable, the application MUST copy the promotional text + URL via `navigator.clipboard.writeText` and display a transient success state.
* **FR-SHARE-008 (Capture Boundary)**: Application controls (`Share Score`, `Retake Quiz`) MUST be rendered as sibling elements outside the capturable card surface.
* **FR-SHARE-009 (Zero Scoring Changes)**: The share feature MUST consume `SleepmaxxResult` as read-only input. Under no circumstances may scoring weights, formulas, or sanitizers be modified.

---

## 5. Non-Functional & Architectural Constraints

* **CR-SHARE-001 (Zero Dependencies)**: No third-party rendering libraries (`html2canvas`, `html-to-image`, `dom-to-image`) may be installed. Asset generation must use native client-side HTML5 Canvas 2D API.
* **CR-SHARE-002 (Transient User Activation)**: Image generation must complete in $<25\text{ms}$ to ensure the call to `navigator.share` occurs within the synchronous user-gesture window enforced by iOS Safari and Android Chrome.
* **CR-SHARE-003 (Local-First & Offline)**: All generation and sharing fallbacks must function without an internet connection once the PWA assets are cached.
* **CR-SHARE-004 (Accessibility)**: The "Share Score" button must support keyboard navigation (Tab, Enter, Space), have an explicit `aria-label`, and announce loading and feedback states via `aria-live`.

---

## 6. Scope Boundaries & Exclusions

The following features are **explicitly excluded** from this specification:
* No server-side rendering (SSR) or Node-canvas microservice.
* No direct TikTok or Instagram Graph API OAuth integration (sharing relies on native OS share sheet).
* No image hosting, cloud uploads (S3/Cloudinary), or shortened URL redirects.
* No analytics tracking SDKs or share event telemetry.
* No payment gates or protocol paywalls.
