# Feature Specification: Sleepmaxx Quiz

**Feature Identifier**: `specs/001-sleepmaxx-quiz`

**Created**: 2026-09-17

**Status**: Draft (Specification Only)

**Input User Description**:
> "Build the Sleepmaxx mobile-first quiz funnel. Users should answer five short questions about their declared sleep routine, then receive a deterministic Sleepmaxx Routine Score from 0 to 100, an archetype, and their biggest weakness. The quiz must use the existing scoring engine as the single scoring implementation. The score result must be visually designed for sharing later. The quiz must not yet contain payment or the 7-day protocol."

**Governing Standards & References**:
* [`docs/PRD.md`](file:///home/hasashi/Bureau/SLEEPMAXX/docs/PRD.md) (Authoritative Product Requirements Document)
* [`docs/SCORING_SPEC.md`](file:///home/hasashi/Bureau/SLEEPMAXX/docs/SCORING_SPEC.md) (Authoritative Scoring Engine Contract)
* [`.specify/memory/constitution.md`](file:///home/hasashi/Bureau/SLEEPMAXX/.specify/memory/constitution.md) (Project Constitution)

---

## 1. User Scenarios & Testing *(mandatory)*

### User Story 1 — End-to-End Quiz Journey (Priority: P1)

A young adult arrives at the Sleepmaxx web application from a social media post, completes the 5-question routine assessment on their smartphone in under 45 seconds using touch-friendly options, and immediately views their deterministic Sleepmaxx Routine Score, archetype badge, and primary weakness without account creation or paywalls.

**Why this priority**:
This is the core acquisition engine and primary viral hook of Sleepmaxx. Without a functional, frictionless quiz-to-result loop, no subsequent sharing, retention, or monetization can occur.

**Independent Test**:
Can be fully tested by launching the landing view, advancing through 5 questions with valid selections, and asserting that the resulting screen displays the exact score (0–100), archetype name, and primary weakness matching the pure scoring engine calculation.

**Acceptance Scenarios**:
1. **Given** a user is on the landing screen, **When** they tap "Start Quiz" (or primary call to action), **Then** Question 1 (Sleep Duration) is displayed with a clear progress indicator showing Step 1 of 5.
2. **Given** a user is on Question 1 through Question 5, **When** they tap a selectable option, **Then** the selection is registered and the interface advances to the next question.
3. **Given** a user has answered Question 5 (Morning Light), **When** the final question is submitted, **Then** the application normalizes all answers into the scoring contract, invokes the scoring engine, and transitions to the Result Screen displaying the overall score (0–100), archetype label (e.g., "ZOMBIE"), category breakdown, and biggest weakness.
4. **Given** a user is viewing their score on the Result Screen, **Then** no paywall, payment request, or account registration form blocks access to the score or archetype.

---

### User Story 2 — Step-by-Step Navigation & Correction (Priority: P2)

A user filling out the questionnaire realizes they selected the wrong caffeine cutoff timing or bedtime shift on a previous step and wishes to go back and correct it without losing the rest of their session answers or breaking the evaluation.

**Why this priority**:
High friction or inability to correct mistakes leads to drop-offs or corrupted assessments, degrading user trust in the score.

**Independent Test**:
Advance to Question 3, tap "Back", alter Question 2 selection, advance forward again, complete the quiz, and verify that the final score reflects the updated answer.

**Acceptance Scenarios**:
1. **Given** a user is on Question 2, 3, 4, or 5, **When** they tap the "Back" control, **Then** the interface transitions safely to the previous question with their previously chosen selection pre-selected.
2. **Given** a user is on Question 1, **When** viewing the interface, **Then** the "Back" control either safely returns to the landing screen or is disabled, preventing invalid negative navigation states.
3. **Given** a user modifies a previous question's answer, **When** they re-advance to later questions, **Then** previously entered downstream answers are retained unless logically invalidated.

---

### User Story 3 — In-Session Resilience & Refresh Handling (Priority: P3)

A user accidentally refreshes their mobile browser tab or switches to another mobile application briefly while in the middle of Question 3.

**Why this priority**:
Mobile web users experience frequent browser reloads, interruptions, and background tab discarding. Preserving in-progress quiz state prevents frustration.

**Independent Test**:
Answer Questions 1 and 2, refresh the browser page, and verify the user resumes on Question 3 with Questions 1 and 2 answers intact.

**Acceptance Scenarios**:
1. **Given** an active quiz session with answers recorded for steps 1 and 2, **When** the browser window is refreshed, **Then** the session state is restored from local storage and the user remains at the current step with previous answers preserved.
2. **Given** a user has reached the Result Screen, **When** the browser is refreshed, **Then** the calculated result remains visible without forcing the user to re-take the questionnaire from scratch.
3. **Given** a user on the Result Screen taps "Retake Quiz", **When** confirmed, **Then** previous answers are cleared and the questionnaire restarts cleanly from Question 1.

---

### User Story 4 — Social Distribution-Ready Result State (Priority: P3)

A user who receives an archetype and score wants to prepare to share their outcome on TikTok or Instagram Stories.

**Why this priority**:
Supports the viral growth loop defined in `docs/PRD.md` Section 9 and Section 16. While native canvas export/sharing is scheduled for subsequent polish, the Result view must be structured as a high-density, visually striking, self-contained card.

**Independent Test**:
Inspect the Result view at mobile dimensions (375px–430px) and verify that the score card contains the score, archetype badge, weakness highlight, and app branding formatted clearly for vertical screen capture.

**Acceptance Scenarios**:
1. **Given** the user reaches the Result view, **Then** a dedicated, unified scorecard component is presented containing:
   * Prominent numeric score (e.g. `54 / 100`)
   * Archetype badge (`COOKED`, `ZOMBIE`, `RECOVERING`, `SLEEPMAXXED`, or `ELITE`)
   * Primary Weakness badge with point loss indicator
   * Brand watermark (`Sleepmaxx`)
2. **Given** the scorecard is rendered on mobile viewports, **Then** it fits completely within a standard mobile screen height without requiring excessive vertical scrolling to capture in a screenshot.

---

### Edge Cases

* **EC-001 (Zero Caffeine Path)**: User selects "I don't drink caffeine". The system must cleanly map this to `hoursSinceLastCaffeineBeforeBed = null`, awarding the full 20 points without throwing runtime null reference errors.
* **EC-002 (Skipping / Incomplete Steps)**: User attempts to advance to the next step without choosing an option. The system must prevent forward progression until a valid selection is made.
* **EC-003 (Browser Back Button vs. In-App Back)**: User triggers the browser's hardware/gesture back button. The internal history/state must synchronize with the router or step state so that the browser does not unexpectedly exit the web app.
* **EC-004 (Rapid Multi-Tap)**: User taps an option multiple times in rapid succession. The interaction must be debounced or gated so that multiple question steps are not inadvertently skipped.
* **EC-005 (Corrupted Local Storage)**: If local storage contains partial or corrupted session data on startup, the system must gracefully discard the corrupt record and initialize a clean landing state without crashing.

---

## 2. Requirements *(mandatory)*

### Functional Requirements

* **FR-001 (Landing Entry)**: The feature MUST provide a mobile-first entry screen presenting the core value proposition ("Discover your Sleepmaxx Score. Can you reach 90 in 7 days?") and a single primary action to start the questionnaire.
* **FR-002 (Single-Question Focus)**: The questionnaire MUST present exactly one question at a time to minimize cognitive load on mobile devices.
* **FR-003 (Question 1 — Sleep Duration)**: System MUST collect declared nocturnal sleep duration via discrete, touch-friendly duration brackets mapping to decimal hours:
  * `< 5 hours` $\rightarrow 4.5$ hrs ($0$ pts)
  * `5 – 5.9 hours` $\rightarrow 5.5$ hrs ($10$ pts)
  * `6 – 6.9 hours` $\rightarrow 6.5$ hrs ($22$ pts)
  * `7 – 8.9 hours` $\rightarrow 8.0$ hrs ($35$ pts)
  * `9 – 9.9 hours` $\rightarrow 9.5$ hrs ($33$ pts)
  * `10+ hours` $\rightarrow 10.5$ hrs ($30$ pts)
* **FR-004 (Question 2 — Weekend Bedtime Shift)**: System MUST collect declared difference between weekday and weekend bedtime via discrete brackets mapping to shift hours:
  * `No shift (0h)` $\rightarrow 0.0$ hrs ($25$ pts)
  * `< 1 hour` $\rightarrow 0.5$ hrs ($22$ pts)
  * `1 – 1.9 hours` $\rightarrow 1.5$ hrs ($17$ pts)
  * `2 – 2.9 hours` $\rightarrow 2.5$ hrs ($10$ pts)
  * `3+ hours` $\rightarrow 3.5$ hrs ($0$ pts)
* **FR-005 (Question 3 — Caffeine Cutoff)**: System MUST collect hours between last caffeine consumption and bedtime via discrete brackets:
  * `No caffeine` $\rightarrow null$ ($20$ pts)
  * `8+ hours before bed` $\rightarrow 9.0$ hrs ($20$ pts)
  * `6 – 7.9 hours` $\rightarrow 7.0$ hrs ($18$ pts)
  * `4 – 5.9 hours` $\rightarrow 5.0$ hrs ($14$ pts)
  * `2 – 3.9 hours` $\rightarrow 3.0$ hrs ($7$ pts)
  * `< 2 hours before bed` $\rightarrow 1.0$ hr ($0$ pts)
* **FR-006 (Question 4 — Screen Time in Bed)**: System MUST collect minutes of illuminated digital screen usage in bed prior to sleep:
  * `0 minutes` $\rightarrow 0$ min ($10$ pts)
  * `1 – 14 minutes` $\rightarrow 10$ min ($9$ pts)
  * `15 – 29 minutes` $\rightarrow 20$ min ($7$ pts)
  * `30 – 59 minutes` $\rightarrow 45$ min ($4$ pts)
  * `60+ minutes` $\rightarrow 75$ min ($0$ pts)
* **FR-007 (Question 5 — Morning Sunlight)**: System MUST collect discrete morning outdoor sunlight frequency:
  * `Almost Always` $\rightarrow "almost\_always"$ ($10$ pts)
  * `Often` $\rightarrow "often"$ ($7$ pts)
  * `Rarely` $\rightarrow "rarely"$ ($3$ pts)
  * `Never` $\rightarrow "never"$ ($0$ pts)
* **FR-008 (Single Scoring Implementation)**: The feature MUST delegate all scoring calculation to the verified pure function `calculateSleepmaxxScore` imported from `src/core/scoringEngine.ts`. UI components MUST NOT duplicate any calculation, threshold, or weakness selection logic.
* **FR-009 (Input Normalization)**: The quiz controller MUST transform user option selections into a strictly valid `QuizAnswers` object before invoking `calculateSleepmaxxScore`.
* **FR-010 (No Free-Form Text)**: All questions MUST be answerable via touch-friendly cards or buttons. No keyboard text input may be required.
* **FR-011 (Progress Indication)**: The quiz interface MUST display an explicit progress indicator (e.g., "Step 2 of 5" with a visual bar) throughout the questionnaire.
* **FR-012 (Result Display)**: The Result view MUST present:
  * Overall Sleepmaxx Routine Score ($0$ to $100$)
  * Archetype label (`COOKED`, `ZOMBIE`, `RECOVERING`, `SLEEPMAXXED`, `ELITE`)
  * Primary Weakness category name and point deduction
  * Category breakdown accordion or card list
  * Non-medical wellness disclaimer
* **FR-013 (Retake Capability)**: The Result view MUST provide a clear "Retake Quiz" option allowing the user to reset their session and start fresh.
* **FR-014 (Session Persistence)**: In-progress quiz answers and final score results MUST be persisted to client-side `localStorage` to survive page reloads.

---

### Key Entities

* **QuizSession**: Represents the state of an in-flight questionnaire.
  * `currentStep`: Numeric index ($0$ for landing, $1$ through $5$ for questions, $6$ for result).
  * `answers`: Partial or complete normalized `QuizAnswers` record.
  * `isComplete`: Boolean flag indicating completion.
* **QuizOption**: Represents a selectable choice presented to the user.
  * `id`: Unique option identifier.
  * `label`: User-facing primary text (e.g., "7 to 8 hours").
  * `sublabel`: Optional explanatory context (e.g., "Highest score bracket").
  * `normalizedValue`: The underlying scalar value matching `QuizAnswers` types.
* **QuizResult**: The output object produced by the scoring engine conforming to `SleepmaxxResult`.

---

## 3. Success Criteria *(mandatory)*

### Measurable Outcomes

* **SC-001 (Completion Velocity)**: A first-time user can complete all 5 questions from landing to result in under **45 seconds**.
* **SC-002 (Scoring Fidelity)**: 100% of generated results match the deterministic contract specified in `docs/SCORING_SPEC.md` with zero score calculation variance.
* **SC-003 (Frictionless Touch UX)**: 100% of interactive controls have a minimum touch target size of at least **44x44 CSS pixels** conforming to mobile accessibility standards.
* **SC-004 (Zero Architectural Leaks)**: Zero scoring math or threshold constants are redefined outside `src/core/scoringEngine.ts`.
* **SC-005 (Persistence Resilience)**: Reloading the browser at any point during Question 1–5 or on the Result view maintains 100% state continuity without data loss or exceptions.
* **SC-006 (Zero API Cost)**: Quiz execution generates zero external network calls, zero third-party API dependencies, and runs fully offline after initial asset load.

---

## 4. UX & Visual Direction

* **Visual Direction**: Dark theme strictly adhering to `docs/PRD.md` Section 15. Deep dark background (`#0B0F17` / `#05070A`), high-contrast foreground text, glowing emerald/mint accents for high scores, amber for moderate scores, and alert crimson for low scores.
* **Typography**: Clean, readable sans-serif typography with high legibility on mobile screens.
* **Transitions**: Crisp, subtle screen slide/fade transitions between steps without heavy or distracting animations.
* **Accessibility**: Full keyboard navigability (Tab, Enter, Space) and ARIA radio/button roles for all quiz options.

---

## 5. Explicit Non-Goals (Scope Fence)

To maintain focus and avoid premature complexity during Phase 1, the following are strictly out of scope:
1. **Payment & Paywall**: No checkout modal, Stripe/Lemon Squeezy integration, or price presentation.
2. **Paid Protocol Access**: No "7-Day Sleepmaxx Protocol" content or daily action challenge screens.
3. **User Authentication & Accounts**: No email/password forms, OAuth logins, or server-side profiles.
4. **Backend Infrastructure**: No database writes, API endpoints, or cloud storage.
5. **AI Coaching / Chat**: No conversational LLM interfaces or AI assistants.
6. **Hardware & Sensors**: No integration with Apple Health, Google Health Connect, smartwatches, or microphones.
7. **Social Feeds**: No community feeds, commenting systems, or public leaderboards.

---

## 6. Assumptions & Dependencies

* **A-001**: Users access the application via modern mobile browsers (iOS Safari, Android Chrome, mobile Firefox) with standard ECMAScript 2022+ and `localStorage` support.
* **A-002**: The existing scoring engine in [`src/core/scoringEngine.ts`](file:///home/hasashi/Bureau/SLEEPMAXX/src/core/scoringEngine.ts) is fully tested and serves as the single source of truth for all calculations.
* **A-003**: Native CSS and CSS Modules are used for styling without adding TailwindCSS or third-party UI component libraries.
