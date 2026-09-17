# Quickstart Validation Guide: Sleepmaxx Quiz

**Feature**: `specs/001-sleepmaxx-quiz`
**Status**: Completed

## Prerequisites

* Node.js $\ge 20$
* Clean workspace dependencies (`npm install` satisfied)
* Pure scoring engine passing all 77 unit tests

---

## Validation Scenarios

### Scenario 1: Happy Path Quiz Journey
1. **Launch App**: Open the application root (`npm run dev`).
2. **Landing Verification**:
   * Confirm "Sleepmaxx" header, core promise ("Discover your Sleepmaxx Score. Can you reach 90 in 7 days?"), and "Start Quiz" button.
3. **Question Progression**:
   * Click "Start Quiz" $\rightarrow$ verify Question 1 (Duration) appears with "Question 1 of 5".
   * Select `7 – 8.9 hours` $\rightarrow$ verify automatic or smooth transition to Question 2.
   * Select `No shift (Same bedtime)` $\rightarrow$ advances to Question 3.
   * Select `8+ hours before bed` $\rightarrow$ advances to Question 4.
   * Select `0 minutes (No screens in bed)` $\rightarrow$ advances to Question 5.
   * Select `Almost Always` $\rightarrow$ advances to Result view.
4. **Result Verification**:
   * Verify score displays `100 / 100`.
   * Verify archetype displays `ELITE`.
   * Verify category breakdown displays 5 items with 0 lost points.
   * Verify non-medical disclaimer is clearly visible.

---

### Scenario 2: Navigation & Correction Verification
1. Start quiz from Landing.
2. On Question 1, select `< 5 hours`.
3. On Question 2, tap "Back" button $\rightarrow$ verify user returns to Question 1 with `< 5 hours` selected.
4. Change selection to `7 – 8.9 hours` $\rightarrow$ advance forward to Question 2.
5. Complete remaining questions with max-score selections.
6. Verify final score reflects the updated Question 1 selection (score `100`, not `65`).

---

### Scenario 3: Page Reload & State Resilience
1. Start quiz and answer Question 1 and Question 2.
2. While on Question 3 (Caffeine), refresh the browser page (`F5` / `Ctrl+R`).
3. Verify the browser returns directly to Question 3 with previous answers preserved in local storage.
4. Complete the quiz to reach the Result screen.
5. Refresh the browser page while on Result screen.
6. Verify the Result screen is immediately re-rendered without resetting to Landing.

---

### Scenario 4: Retake Quiz Reset
1. On the Result screen, click the "Retake Quiz" button.
2. Verify state resets to Landing (or Question 1), local storage session is cleared, and answering anew produces fresh calculations.

---

## Automated Verification Commands

```bash
# 1. Run all scoring engine and feature tests
npm test

# 2. Strict TypeScript typechecking
npx tsc -b

# 3. Production build validation
npm run build
```
