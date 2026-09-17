# Phase 0 Research: Sleepmaxx Quiz Architecture

**Feature**: `specs/001-sleepmaxx-quiz`
**Status**: Completed

## 1. Technical Decisions & Findings

### Decision 1: State Machine & State Management Architecture
* **Decision**: Implement a predictable, pure reducer-based state machine using React's `useReducer` encapsulated in a custom hook `useQuizState`.
* **Rationale**:
  * The quiz funnel has strictly defined sequential states (`landing` $\rightarrow$ `question` (0–4) $\rightarrow$ `result`).
  * A state machine prevents invalid transition states (e.g., viewing results without answering questions, or negative question indexes).
  * Decouples navigation and state logic completely from presentation components, enabling 100% testability of state transitions in isolation without DOM rendering.
* **Alternatives Considered**:
  * *Global store (Zustand / Redux)*: Rejected. Unnecessary dependency. The quiz funnel is self-contained and local.
  * *Multiple `useState` hooks*: Rejected. Prone to state synchronization bugs (e.g., mismatch between `currentStep`, `answers`, and `result` during rapid taps or back navigation).

---

### Decision 2: Location and Segregation of Types
* **Decision**:
  * Core mathematical scoring types (`QuizAnswers`, `SleepmaxxResult`, `SleepmaxxCategory`, `SleepmaxxArchetype`, `CategoryResult`) live in [`src/core/scoringEngine.ts`](file:///home/hasashi/Bureau/SLEEPMAXX/src/core/scoringEngine.ts).
  * Feature UI types (`QuizQuestion`, `QuizOptionItem`, `QuizState`, `QuizAction`, `QuizStep`) live in `src/features/quiz/types.ts` and import the core types.
* **Rationale**:
  * Preserves the core scoring engine as a zero-dependency, headless module that knows nothing about React or UI questions.
  * Allows feature-specific structures (question copy, sublabels, step indicators) to evolve without touching the verified scoring engine.
* **Alternatives Considered**:
  * *Defining UI question types inside `scoringEngine.ts`*: Rejected. Violates separation of concerns and pollutes pure engine code with presentation copy.

---

### Decision 3: UI Answer to Normalized Scoring Engine Contract Mapping
* **Decision**: Define static question configuration objects in `src/features/quiz/data/questions.ts` where each selectable option explicitly stores its normalized scalar value conforming to `QuizAnswers`.
* **Rationale**:
  * Direct 1-to-1 mapping eliminates translation layers and heuristic parsing.
  * Durations map to decimal hours ($4.5, 5.5, 6.5, 8.0, 9.5, 10.5$).
  * Weekend shift maps to decimal hours ($0.0, 0.5, 1.5, 2.5, 3.5$).
  * Caffeine maps to `null` ("No caffeine") or cutoff hours ($9.0, 7.0, 5.0, 3.0, 1.0$).
  * Screen minutes map to integer minutes ($0, 10, 20, 45, 75$).
  * Sunlight maps directly to `MorningLightFrequency` literals (`'almost_always'`, `'often'`, `'rarely'`, `'never'`).
* **Alternatives Considered**:
  * *Free-form inputs / sliders*: Rejected. Introduces mobile input friction, invalid entries, and keyboard popup shifting on mobile viewports.

---

### Decision 4: LocalStorage Persistence & Resilience
* **Decision**: Create an isolated storage adapter `src/features/quiz/storage.ts` managing the `sleepmaxx_quiz_session_v1` key with schema validation.
* **Rationale**:
  * Mobile browser tabs frequently refresh or unload when switching apps.
  * Saving `{ step, questionIndex, answers, result }` after every state transition ensures seamless continuity.
  * Validates data with a defensive schema guard. If corrupt data or older schemas are encountered, it safely resets without throwing uncaught runtime errors.
* **Alternatives Considered**:
  * *SessionStorage*: Rejected. Cleared when mobile browser closes or tabs are recycled.
  * *IndexedDB*: Rejected. Overkill for storing a <1KB JSON object; adds asynchronous complexity.

---

### Decision 5: Funnel Navigation (Back / Next / Rapid-Tap / Refresh)
* **Decision**:
  * **Next**: Advance on option select with a 150ms debounce/gate to give tactile visual feedback and prevent accidental multi-step skipping.
  * **Back**: Explicit top-left back button. On questions 1–4, decrements `questionIndex` and preserves previously selected value. On question 0, returns to `landing`. Hidden on `result`.
  * **Refresh**: On initial load, state initializes from storage. If completed, directly displays `result`. If mid-quiz, resumes on current question.
* **Alternatives Considered**:
  * *Browser History (`history.pushState`)*: Kept minimal. Can be synchronized simply with state transitions so hardware back gestures match in-app back buttons.

---

### Decision 6: Zero Scoring Duplication
* **Decision**: All scoring execution is strictly confined to `calculateSleepmaxxScore(answers)`.
* **Rationale**:
  * Prevents UI components from calculating intermediate percentages, thresholds, or weaknesses.
  * The result view directly consumes the structured `SleepmaxxResult`.

---

### Decision 7: Social Sharing Preparation Without Premature Architecture
* **Decision**: Encapsulate the result view's core visual into an isolated `<ScoreCard result={result} />` component designed with vertical aspect ratio (9:16 mobile canvas friendly) and distinct branding.
* **Rationale**:
  * Users in Phase 1 can immediately take a clean, beautiful vertical screenshot on their smartphones.
  * In Phase 4 (Viral Optimization), canvas export or Web Share API can attach to this `<ScoreCard>` via React ref without rewriting any layout.

---

### Decision 8: Mobile-First 375px–430px Responsive Strategy
* **Decision**:
  * Single column centered layout constrained to `max-width: 440px`.
  * Viewport unit: `min-height: 100dvh` to absorb mobile browser address bar expansions.
  * Safe area padding: `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)`.
  * Touch targets: Minimum 52px touch height with 12px vertical gaps between option cards.

---

### Decision 9: Testing Strategy Beyond the 77 Engine Tests
* **Decision**: Add unit and component tests targeting:
  1. Reducer transitions (`useQuizState.test.ts`): state changes, back navigation, score calculation trigger.
  2. Storage adapter (`storage.test.ts`): serialization, deserialization, corrupt payload handling.
  3. Integration flow (`QuizFunnel.test.tsx`): complete landing $\rightarrow$ 5 questions $\rightarrow$ result screen simulation.
