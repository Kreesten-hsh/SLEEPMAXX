# Implementation Plan: Sleepmaxx Quiz Funnel

**Branch**: `001-sleepmaxx-quiz` | **Date**: 2026-09-17 | **Spec**: [`specs/001-sleepmaxx-quiz/spec.md`](file:///home/hasashi/Bureau/SLEEPMAXX/specs/001-sleepmaxx-quiz/spec.md)

**Input**: Feature specification from [`specs/001-sleepmaxx-quiz/spec.md`](file:///home/hasashi/Bureau/SLEEPMAXX/specs/001-sleepmaxx-quiz/spec.md)

---

## Summary

Implements Phase 1 of the Sleepmaxx product: the mobile-first, 5-question routine quiz funnel (Landing $\rightarrow$ Quiz $\rightarrow$ Result). A lightweight, predictable state machine (`useQuizState`) orchestrates the single-question flow, normalizes user selections directly into the existing `QuizAnswers` contract, delegates score computation exclusively to the pure scoring engine ([`src/core/scoringEngine.ts`](file:///home/hasashi/Bureau/SLEEPMAXX/src/core/scoringEngine.ts)), handles in-session resilience via a defensive `localStorage` adapter, and renders a share-ready scorecard component.

---

## Technical Context

* **Language / Version**: TypeScript 6.0.3 (ES2022 target, strict mode, zero `any`)
* **Framework**: React 19.3.0
* **Build System / Bundler**: Vite 8.3.0
* **Styling**: Native CSS & CSS Modules (no utility libraries; curated dark theme tokens)
* **Storage**: Client-side `localStorage` (`sleepmaxx_quiz_session_v1`)
* **Testing**: Vitest 4.1.11 (unit tests for reducer, storage, and UI flow)
* **Target Platform**: Mobile-first responsive web / PWA (optimized for 375px–430px viewports)
* **Performance Goals**: Screen transitions $<16\text{ms}$ (60fps), score evaluation $<1\text{ms}$
* **Constraints**: 100% offline capable after initial asset load; zero external API requests; zero AI dependencies; zero payment/monetization code in this phase
* **Scale / Scope**: Single self-contained feature (`src/features/quiz/`)

---

## Constitution Check

*GATE: All gates must pass before task generation.*

1. **Source of Truth Supremacy**: PASSED. Conforms strictly to [`docs/PRD.md`](file:///home/hasashi/Bureau/SLEEPMAXX/docs/PRD.md) and [`docs/SCORING_SPEC.md`](file:///home/hasashi/Bureau/SLEEPMAXX/docs/SCORING_SPEC.md).
2. **Pure, Zero-Dependency Scoring Engine**: PASSED. [`src/core/scoringEngine.ts`](file:///home/hasashi/Bureau/SLEEPMAXX/src/core/scoringEngine.ts) remains completely untouched and is the single mathematical engine.
3. **Test-Driven & Regression Gates**: PASSED. All 77 existing unit tests must continue to pass; comprehensive new tests added for reducer and storage.
4. **Zero-Budget & Local-First Architecture**: PASSED. Zero server infrastructure, zero API costs, local-first execution.
5. **Non-Clinical Wellness Positioning**: PASSED. Zero medical diagnosis copy; all options and labels use declared-habit gamification framing.

---

## Architectural Decisions Addressing Core Questions

### 1. State Architecture
* **Pattern**: Deterministic finite state machine via `useReducer` inside `useQuizState`.
* **State Shape**:
  ```typescript
  type QuizStep = 'landing' | 'question' | 'result';
  interface QuizState {
    step: QuizStep;
    questionIndex: number; // 0 to 4
    answers: Partial<QuizAnswers>;
    result: SleepmaxxResult | null;
  }
  ```
* **Actions**: `START_QUIZ`, `ANSWER_QUESTION`, `PREVIOUS_QUESTION`, `RETAKE_QUIZ`, `RESTORE_SESSION`.

### 2. Location of Types
* **Core Scoring Contract**: Stays in [`src/core/scoringEngine.ts`](file:///home/hasashi/Bureau/SLEEPMAXX/src/core/scoringEngine.ts) (`QuizAnswers`, `SleepmaxxResult`, etc.).
* **Feature Domain Types**: Live in `src/features/quiz/types.ts` (`QuizQuestion`, `QuizOptionItem`, `QuizState`, `QuizAction`, `QuizStep`).

### 3. Answer Mapping to Scoring Engine Contract
* Static question configuration (`src/features/quiz/data/questions.ts`) directly embeds scalar `normalizedValue` for each choice:
  * Q1 Duration: `4.5`, `5.5`, `6.5`, `8.0`, `9.5`, `10.5`
  * Q2 Consistency: `0.0`, `0.5`, `1.5`, `2.5`, `3.5`
  * Q3 Caffeine: `null`, `9.0`, `7.0`, `5.0`, `3.0`, `1.0`
  * Q4 Screen: `0`, `10`, `20`, `45`, `75`
  * Q5 Sunlight: `'almost_always'`, `'often'`, `'rarely'`, `'never'`
* When Question 5 is answered, the aggregated `QuizAnswers` object is passed directly to `calculateSleepmaxxScore(answers)`.

### 4. Clean LocalStorage Management
* Isolated storage adapter: `src/features/quiz/storage.ts`.
* Key: `sleepmaxx_quiz_session_v1`.
* Versioned payload with defensive validation: corrupted or outdated sessions are cleanly discarded with fallback to initial state. All calls wrapped in `try/catch`.

### 5. Back / Next / Refresh Navigation
* **Next**: Option tap records answer and advances `questionIndex` with a 150ms tactile feedback gate.
* **Back**: In-app button on questions 1–4 decrements `questionIndex` and preserves chosen state. On question 0, returns to Landing. Disabled on Result.
* **Refresh**: State initializes from `storage.loadSession()`. Re-renders active question or completed result without data loss.

### 6. Landing $\rightarrow$ Quiz $\rightarrow$ Result Structure
* `QuizContainer.tsx` acts as the conditional view orchestrator:
  * `step === 'landing'` $\rightarrow$ `<LandingScreen onStart={startQuiz} />`
  * `step === 'question'` $\rightarrow$ `<QuestionScreen question={current} currentAnswer={answers[key]} onAnswer={answer} onBack={back} />`
  * `step === 'result'` $\rightarrow$ `<ResultScreen result={result} onRetake={retake} />`

### 7. Zero Scoring Duplication
* Absolute rule: No scoring calculations, formulas, or bracket thresholds are written in any React component or UI helper.
* Computation is strictly triggered via `calculateSleepmaxxScore(answers)`.

### 8. Result Preparation for Future Social Sharing
* Isolate the visual outcome into `<ScoreCard result={result} />`.
* Styled as a vertical card with high-contrast dark palette, glowing accents, score gauge, archetype badge, weakness deduction, and brand watermark.
* Ready for native screenshot capture in Phase 1 and future DOM-to-image/Canvas export in Phase 4 via React `ref`.

### 9. Responsive Strategy (375px–430px)
* Container capped at `max-width: 440px` with `margin: 0 auto; min-height: 100dvh`.
* Full-width tactile touch targets with minimum `min-height: 52px` and `padding: 14px 16px`.
* Native CSS variables for consistent theming and smooth mobile viewport handling.

### 10. Test Strategy Beyond 77 Engine Tests
* Reducer & state machine unit tests (`useQuizState.test.ts`): all transitions, back navigation, score trigger, retake reset.
* Storage adapter tests (`storage.test.ts`): serialization, deserialization, corrupt payload recovery.
* Component render tests (`QuizContainer.test.tsx`): verifies the complete landing-to-result user journey.

---

## Project Structure

### Documentation (`specs/001-sleepmaxx-quiz/`)

```text
specs/001-sleepmaxx-quiz/
├── spec.md              # Feature specification
├── plan.md              # This implementation plan
├── research.md          # Phase 0 research & architectural decisions
├── data-model.md        # Phase 1 data model & state lifecycle
├── quickstart.md        # Phase 1 validation scenarios
├── contracts/
│   └── quiz-contract.md # UI, hook, and storage interface contracts
└── checklists/
    └── requirements.md  # Quality validation checklist
```

### Source Code Layout

```text
src/
├── core/                        # PURE SCORING CORE (UNTOUCHED)
│   ├── scoringEngine.ts         # Authoritative mathematical implementation
│   └── scoringEngine.test.ts    # 77 verified unit tests
├── features/
│   └── quiz/                    # PHASE 1 FEATURE MODULE
│       ├── components/
│       │   ├── QuizContainer.tsx
│       │   ├── LandingScreen.tsx
│       │   ├── QuestionScreen.tsx
│       │   ├── ResultScreen.tsx
│       │   ├── ScoreCard.tsx
│       │   └── ProgressBar.tsx
│       ├── data/
│       │   └── questions.ts     # 5 questions with normalized scoring values
│       ├── types.ts             # Feature state & question types
│       ├── storage.ts           # LocalStorage adapter
│       ├── storage.test.ts      # Storage tests
│       ├── useQuizState.ts      # Reducer hook
│       └── useQuizState.test.ts # State machine tests
├── App.tsx                      # Renders QuizContainer
├── main.tsx                     # React entry point
└── index.css                    # Design tokens & dark mode layout
```

---

## Complexity Tracking

*No constitution violations or unwarranted complexity introduced.* Zero backend, zero AI, zero payment, zero analytics SDK.
