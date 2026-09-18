# Interface Contract: Sleepmaxx Quiz

**Feature**: `specs/001-sleepmaxx-quiz`
**Status**: Completed

## 1. Questions Contract (`src/features/quiz/data/questions.ts`)

The five questions strictly provide discrete options mapping to the scoring contract in [`docs/SCORING_SPEC.md`](file:///home/hasashi/Bureau/SLEEPMAXX/docs/SCORING_SPEC.md):

### Question 1: Sleep Duration (`sleepDurationHours`)
* **Title**: "How many hours of sleep do you average per night?"
* **Options**:
  1. `< 5 hours` $\rightarrow$ `4.5`
  2. `5 – 5.9 hours` $\rightarrow$ `5.5`
  3. `6 – 6.9 hours` $\rightarrow$ `6.5`
  4. `7 – 8.9 hours` $\rightarrow$ `8.0` *(Highest score bracket)*
  5. `9 – 9.9 hours` $\rightarrow$ `9.5`
  6. `10+ hours` $\rightarrow$ `10.5`

### Question 2: Weekend Bedtime Shift (`weekendShiftHours`)
* **Title**: "How much does your bedtime shift on weekends?"
* **Options**:
  1. `No shift (Same bedtime)` $\rightarrow$ `0.0` *(Highest score bracket)*
  2. `Under 1 hour` $\rightarrow$ `0.5`
  3. `1 – 1.9 hours` $\rightarrow$ `1.5`
  4. `2 – 2.9 hours` $\rightarrow$ `2.5`
  5. `3+ hours` $\rightarrow$ `3.5`

### Question 3: Caffeine Cutoff (`hoursSinceLastCaffeineBeforeBed`)
* **Title**: "How many hours before bed is your last caffeine intake?"
* **Options**:
  1. `I don't drink caffeine` $\rightarrow$ `null` *(Highest score bracket)*
  2. `8+ hours before bed` $\rightarrow$ `9.0` *(Highest score bracket)*
  3. `6 – 7.9 hours` $\rightarrow$ `7.0`
  4. `4 – 5.9 hours` $\rightarrow$ `5.0`
  5. `2 – 3.9 hours` $\rightarrow$ `3.0`
  6. `< 2 hours before bed` $\rightarrow$ `1.0`

### Question 4: Screen Time in Bed (`screenMinutesInBed`)
* **Title**: "How long are you on your phone in bed before trying to sleep?"
* **Options**:
  1. `0 minutes (No screens in bed)` $\rightarrow$ `0` *(Highest score bracket)*
  2. `1 – 14 minutes` $\rightarrow$ `10`
  3. `15 – 29 minutes` $\rightarrow$ `20`
  4. `30 – 59 minutes` $\rightarrow$ `45`
  5. `60+ minutes` $\rightarrow$ `75`

### Question 5: Morning Sunlight (`morningLightFrequency`)
* **Title**: "Do you get outdoor natural sunlight within an hour of waking?"
* **Options**:
  1. `Almost Always` $\rightarrow$ `'almost_always'` *(Highest score bracket)*
  2. `Often` $\rightarrow$ `'often'`
  3. `Rarely` $\rightarrow$ `'rarely'`
  4. `Never` $\rightarrow$ `'never'`

---

## 2. Hook Interface Contract (`useQuizState`)

```typescript
export interface UseQuizStateReturn {
  readonly state: QuizState;
  readonly currentQuestion: QuizQuestion | null;
  readonly progressPercentage: number; // 0 on landing, 20-100 on questions, 100 on result
  readonly startQuiz: () => void;
  /**
   * Registers selected answer, visually highlights the option for ~150ms,
   * then auto-advances to the next question (or Result).
   * Gates rapid multi-taps during transition. No "Next" button needed.
   */
  readonly answerCurrentQuestion: (value: QuizAnswers[keyof QuizAnswers]) => void;
  /**
   * 100% in-app back navigation.
   * If on Q2-Q5, decrements questionIndex and preserves prior answer.
   * If on Q1 (index 0), transitions back to 'landing'.
   * Zero window.history or popstate manipulation.
   */
  readonly goToPreviousQuestion: () => void;
  /**
   * Full reset: empties answers, deletes result, clears localStorage session,
   * resets state machine, and returns to 'landing' (Result → Retake → Landing).
   */
  readonly retakeQuiz: () => void;
}
```

---

## 3. Storage Adapter Contract (`src/features/quiz/storage.ts`)

```typescript
export interface QuizStorage {
  loadSession(): QuizState | null;
  saveSession(state: QuizState): void;
  clearSession(): void;
}
```

* **Storage Key**: `'sleepmaxx_quiz_session_v1'`
* **Error handling**: All calls wrapped in `try/catch` to tolerate private browsing restrictions or quota limits.

---

## 4. ScoreCard Presentation Contract (`src/features/quiz/components/ScoreCard.tsx`)

```typescript
export interface ScoreCardProps {
  readonly result: SleepmaxxResult;
  readonly onRetake?: () => void;
  readonly testId?: string;
}
```

* **DOM Layout Requirements**:
  * Unified container element with class `.scorecard-container`.
  * Distinct data-attributes for testing:
    * `data-testid="score-value"`
    * `data-testid="archetype-badge"`
    * `data-testid="weakness-badge"`
    * `data-testid="brand-watermark"`
  * Ready for future `useRef` target for `navigator.share` or canvas image capture without internal DOM refactoring.
