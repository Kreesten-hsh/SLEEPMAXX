# Research & Architectural Decision: ScoreCard Export & Sharing

**Feature**: `specs/002-growth-share`  
**Date**: 2026-09-18  
**Status**: Revised Architectural Decision  

---

## 1. Technical Problem Statement

To complete the Sleepmaxx acquisition loop, the application must export the user's score result into a high-density, vertical visual asset formatted for social media stories (TikTok, Instagram, Snapchat) and deliver it seamlessly via native sharing or offline fallbacks.

The solution must satisfy three strict non-functional constraints:
1. **Zero New npm Dependencies**: Adhere strictly to the project's bootstrapped, zero-capital philosophy (`.specify/memory/constitution.md` Principle IV).
2. **Transient User Activation Protection (Risk & Hypothesis)**: On mobile browsers (iOS Safari, Android Chrome), `navigator.share` requires an active user gesture context. Introducing significant asynchronous delays, layout recalculations, or external asset fetching risks triggering browser gesture expiration (`NotAllowedError: Must be handling a user gesture`). The architectural approach must minimize latency between user tap and share dispatch, targeting rapid in-memory asset generation to be empirically validated during testing.
3. **Standardized 9:16 Output**: The generated image must be a standardized, high-resolution 9:16 asset ($1080 \times 1920\text{ px}$) irrespective of whether the user is on an iPhone SE ($375\text{px}$ width) or an iPhone Pro Max ($430\text{px}$ width).

---

## 2. Comprehensive Architectural Options Comparison

### Option A: Pure Native HTML5 Canvas 2D Direct Draw (Selected)

A dedicated, headless TypeScript rendering function (`createScoreCardBlob(result: SleepmaxxResult): Promise<Blob>`) creates an in-memory `<canvas width="1080" height="1920">` and draws the branded background, score hero, archetype pill, weakness box, breakdown bars, and footer using the native 2D canvas context.

* **Browser Standard Support**: Native Canvas 2D is a mature W3C standard supported across modern mobile and desktop browsers (iOS Safari, Android Chrome, mobile Firefox, Samsung Internet).
* **Rendering Model**: Direct 2D context drawing bypasses live DOM traversal and CSS engine reflows.
* **PWA / Offline**: Operates client-side with 0 network calls required.
* **Asset Quality**: Outputs an exact, high-resolution $1080 \times 1920\text{ px}$ PNG without scaling artifacts.
* **Layout Determinism**: Direct mathematical placement of typography, paddings, gradients, and rounded rectangles.
* **Bundle Impact**: **0 KB** external dependencies.
* **Maintenance**: Zero third-party dependency drift; stable web platform API.
* **Testability**: Testable in Vitest via lightweight 2D context mocks.
* **Typography**: Uses system typography stack (`system-ui`, `sans-serif`) and standard Unicode glyphs.
* **User Activation Risk Profile**: Direct drawing executes in memory without DOM parsing passes, minimizing execution overhead before calling `navigator.share`. Actual latency will be measured against a defined performance validation objective.
* **Constitution Alignment**: 100% compliant with zero-dependency and local-first principles.

---

### Option B: DOM-to-Canvas / ForeignObject Libraries (`html2canvas` or `html-to-image`)

Captures the live DOM element of `<ScoreCard />` using an external library that parses computed styles and renders DOM nodes onto an intermediate canvas.

* **Rendering Fragility**: Prone to cross-browser discrepancies with CSS variables (`var(...)`), flexbox subpixel calculations, and high-DPI device pixel ratios.
* **Bundle Impact**: External libraries introduce significant minified bundle weight (typically 30 KB to 160 KB).
* **Dependencies**: Violates Constitution Principle IV ("Zero unnecessary dependencies").
* **Resolution Dependency**: Capturing a $375\text{px}$ viewport element requires artificial scaling to reach $1080\text{px}$, frequently producing blurry typography.
* **User Activation Risk Profile**: DOM tree traversal, CSS computation, and rasterization introduce non-deterministic execution delays. On lower-powered devices, this variance substantially increases the risk of expiring the browser's transient user gesture window.
* **Conclusion**: **REJECTED** due to bundle overhead, rendering unpredictability, and user activation expiration risks.

---

### Option C: Inline SVG Vector Template converted via `Image()`

Generates a static SVG string with embedded styles, converts it to an SVG data URL, loads it into an HTML `Image()` element, and rasterizes it onto a canvas.

* **Browser Security Restrictions**: In WebKit (iOS Safari), exporting an SVG containing embedded assets or external font declarations via `canvas.toBlob()` can trigger security sandbox restrictions ("Tainted canvas may not be exported").
* **Layout Constraints**: SVG text layout requires hardcoded multi-line coordinate calculations or `<foreignObject>`, which is not uniformly supported across browser canvas rasterizers.
* **User Activation Risk Profile**: Asynchronous image loading and decoding introduce event loop delays that complicate synchronous gesture preservation.
* **Conclusion**: **REJECTED** due to canvas security sandboxing risks in WebKit and layout constraints.

---

## 3. Comparison Matrix

| Evaluation Dimension | Option A: Native Canvas 2D | Option B: DOM Capture Library | Option C: Inline SVG Template |
| :--- | :---: | :---: | :---: |
| **New Dependencies** | **0 KB (None)** | Additional external packages | 0 KB |
| **Browser Engine Robustness** | **High** (Standard W3C Canvas 2D API) | Variable (CSS subpixel & variable bugs) | Risk of tainted canvas export in WebKit |
| **Latency Profile** | **Low / Direct Draw** (Target to be measured) | Variable / DOM traversal & reflow | Medium / Async image decode |
| **User Gesture Risk** | **Low** (Direct memory draw before share) | **High** (DOM serialization delay) | **Medium** (Image load event loop hop) |
| **Fixed 1080×1920 9:16 Output** | **Yes** (Viewport independent) | No (Dependent on DOM element width) | Yes |
| **Offline PWA Support** | **Yes** | Yes | Yes |
| **Constitution Compliance** | **100%** | Violation (Extra dependencies) | Partial |

---

## 4. Final Architectural Recommendation & Validation Targets

**Option A (Pure Native HTML5 Canvas 2D Direct Draw)** is selected as the architectural solution for Sleepmaxx:
1. It introduces **zero new npm dependencies**, maintaining the lean production bundle.
2. It operates directly in memory without DOM layout overhead, structurally mitigating the risk of user gesture expiration.
3. It guarantees an exact **$1080 \times 1920\text{ px}$ (9:16)** high-definition image asset for all users, regardless of device viewport.
4. It operates completely client-side, local-first, with zero backend or third-party service costs.

**Validation Target (to be measured during testing)**:
* Image generation must be measured via benchmark tests to verify that in-memory drawing completes rapidly enough to avoid gesture expiration, ensuring `navigator.share` executes reliably within the user activation window.
