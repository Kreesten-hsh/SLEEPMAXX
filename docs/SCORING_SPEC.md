# SOURCE OF TRUTH FOR SCORING BEHAVIOR

> **CRITICAL OPERATING PRINCIPLE**: This document is the authoritative technical and product specification for the **Sleepmaxx Routine Score**. It specifies the exact contract, input schemas, scoring formulas, threshold boundaries, sanitization mechanisms, archetype mappings, and tie-breaking algorithms implemented in [`src/core/scoringEngine.ts`](file:///home/hasashi/Bureau/SLEEPMAXX/src/core/scoringEngine.ts). Any future changes to scoring behavior must update this specification first and maintain full regression safety across all unit tests.

---

# Sleepmaxx Routine Score — Technical & Product Specification

## 1. Purpose

The Sleepmaxx Routine Score quantifies the discipline and quality of a user's **declared daily sleep routine** on a scale from **0 to 100 points**. It provides instant, deterministic feedback on routine hygiene, highlights the single biggest habit bottleneck ("Biggest Weakness"), and categorizes the user into one of five cultural archetypes.

---

## 2. Scope & Boundaries

This specification applies exclusively to the evaluation of self-reported lifestyle inputs.
* **Execution Environment**: Client-side execution in `<1ms`.
* **Side Effects**: Pure functional computation. No network access, no DOM access, no state mutation.
* **Storage**: Input values and score results may be cached in `localStorage` by upstream feature consumers.

---

## 3. Non-Medical Positioning

The Sleepmaxx Routine Score is strictly a **wellness and gamification metric**.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        LEGAL & SAFETY BOUNDARIES                       │
├────────────────────────────────────────────────────────────────────────┤
│ ✕ NOT a medical diagnosis, clinical evaluation, or biometric metric.   │
│ ✕ DOES NOT measure actual sleep duration, sleep latency, or REM/deep.  │
│ ✕ DOES NOT monitor or infer physiological hormones (melatonin,         │
│   cortisol, testosterone, growth hormone).                             │
│ ✕ DOES NOT claim clinical or medical validation.                       │
│ ✓ Evaluates ONLY user-declared habits against sleep hygiene baselines. │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Input Contract

The scoring engine accepts a single immutable JavaScript/TypeScript object adhering to the `QuizAnswers` interface.

```typescript
export type MorningLightFrequency = "almost_always" | "often" | "rarely" | "never";

export interface QuizAnswers {
  /** Average nocturnal sleep duration in decimal hours (e.g., 7.5 = 7h 30m). */
  readonly sleepDurationHours: number;

  /** Absolute difference between weekday and weekend bedtime in decimal hours. */
  readonly weekendShiftHours: number;

  /** Hours between last caffeine consumption and planned bedtime. Null if no caffeine. */
  readonly hoursSinceLastCaffeineBeforeBed: number | null;

  /** Continuous minutes spent using illuminated digital screens in bed before attempting sleep. */
  readonly screenMinutesInBed: number;

  /** Frequency of outdoor sunlight exposure within 60 minutes of waking. */
  readonly morningLightFrequency: MorningLightFrequency;
}
```

---

## 5. Five Scoring Dimensions

The total score is the direct sum of five category scores, totaling a maximum of **100 points**:

```
Total Score (100 pts) = Duration (35) + Consistency (25) + Caffeine (20) + Screen (10) + Morning Light (10)
```

| Dimension | Key | Max Points | Weight (%) | Impact Area |
| :--- | :--- | :---: | :---: | :--- |
| **Sleep Duration** | `duration` | **35** | 35% | Total continuous sleep quantity |
| **Sleep Consistency** | `consistency` | **25** | 25% | Circadian phase stability / social jetlag |
| **Caffeine Timing** | `caffeine` | **20** | 20% | Adenosine receptor clearance before sleep |
| **Screen Habit** | `screen` | **10** | 10% | Pre-sleep blue light & dopaminergic stimulation |
| **Morning Light** | `morningLight` | **10** | 10% | Circadian entrainment via early sunlight |

---

## 6. Exact Scoring Tables & Bracket Logic

### 6.1 Sleep Duration (Category Max: 35 Points)
Evaluates `sleepDurationHours`. Higher value is better up to 8.99 hours; oversleeping is penalized.

$$\text{Sanitized Value } h = \text{safeNonNegative}(hours)$$

| Condition | Earned Points | Rational Bracket |
| :--- | :---: | :--- |
| $h < 5.0$ | **0** | Severe sleep deficit |
| $5.0 \le h < 6.0$ | **10** | Insufficient |
| $6.0 \le h < 7.0$ | **22** | Sub-optimal |
| $7.0 \le h < 9.0$ | **35** | Optimal physiological recovery |
| $9.0 \le h < 10.0$ | **33** | Extended recovery |
| $h \ge 10.0$ | **30** | Excess sleep / recovery debt |

*Sanitization*: Non-finite numbers (`NaN`, `Infinity`, `-Infinity`) and negative values evaluate to `0`, awarding **0 points**.

---

### 6.2 Sleep Consistency / Social Jetlag (Category Max: 25 Points)
Evaluates absolute weekend bedtime shift (`Math.abs(shiftHours)`). Higher shift is worse.

$$\text{Sanitized Value } shift = \text{safeHighIsWorse}(|\text{shiftHours}|)$$

| Condition | Earned Points | Drift Severity |
| :--- | :---: | :--- |
| $shift = 0.0$ | **25** | Perfect circadian lock |
| $0.0 < shift < 1.0$ | **22** | Negligible circadian drift |
| $1.0 \le shift < 2.0$ | **17** | Moderate social jetlag |
| $2.0 \le shift < 3.0$ | **10** | High social jetlag |
| $shift \ge 3.0$ | **0** | Severe circadian dysregulation |

*Sanitization*: Negative inputs are converted via `Math.abs()`. Non-finite values (`NaN`, `Infinity`) map to $\infty$, awarding **0 points**.

---

### 6.3 Caffeine Timing (Category Max: 20 Points)
Evaluates `hoursSinceLastCaffeineBeforeBed`. `null` indicates zero caffeine consumption. Higher value is better.

$$\text{Sanitized Value } h = \begin{cases} 20 \text{ pts} & \text{if input is } \text{null} \\ \text{safeNonNegative}(hours) & \text{otherwise} \end{cases}$$

| Condition | Earned Points | Clearance Phase |
| :--- | :---: | :--- |
| `input === null` | **20** | No caffeine consumed |
| $h \ge 8.0$ | **20** | Full clearance window |
| $6.0 \le h < 8.0$ | **18** | Minor residual level |
| $4.0 \le h < 6.0$ | **14** | Active clearance window |
| $2.0 \le h < 4.0$ | **7** | High circulating caffeine |
| $h < 2.0$ | **0** | Acute adenosine receptor blockage |

*Sanitization*: Non-finite numbers and negative values map to `0`, awarding **0 points**.

---

### 6.4 Screen Habit in Bed (Category Max: 10 Points)
Evaluates `screenMinutesInBed`. Higher value is worse.

$$\text{Sanitized Value } m = \text{safeHighIsWorse}(minutes)$$

| Condition | Earned Points | Blue Light Impact |
| :--- | :---: | :--- |
| $m = 0$ | **10** | Zero in-bed screen stimulation |
| $0 < m < 15$ | **9** | Minimal pre-sleep exposure |
| $15 \le m < 30$ | **7** | Moderate alertness stimulation |
| $30 \le m < 60$ | **4** | Delayed melatonin onset |
| $m \ge 60$ | **0** | Severe circadian & dopamine disruption |

*Sanitization*: Non-finite values (`NaN`, `Infinity`) map to $\infty$, awarding **0 points**. Negative values clamp to `0` (awarding **10 points**).

---

### 6.5 Morning Sunlight Exposure (Category Max: 10 Points)
Evaluates discrete selection `morningLightFrequency`.

| Option | Earned Points | Entrainment Frequency |
| :--- | :---: | :--- |
| `"almost_always"` | **10** | Daily natural circadian anchoring |
| `"often"` | **7** | Frequent sunlight cue |
| `"rarely"` | **3** | Infrequent light exposure |
| `"never"` | **0** | No early photic reset |

---

## 7. Total Score & Output Contract

The scoring engine produces a structured, frozen result object:

```typescript
export interface CategoryResult {
  readonly earned: number;
  readonly max: number;
  readonly lost: number; // Invariant: lost === max - earned
}

export interface SleepmaxxResult {
  readonly totalScore: number; // Invariant: integer in [0, 100]
  readonly categories: {
    readonly duration: CategoryResult;
    readonly consistency: CategoryResult;
    readonly caffeine: CategoryResult;
    readonly screen: CategoryResult;
    readonly morningLight: CategoryResult;
  };
  readonly archetype: {
    readonly id: SleepmaxxArchetype;
    readonly label: string; // Uppercase display string
  };
  readonly biggestWeakness: {
    readonly id: SleepmaxxCategory;
    readonly label: string;
    readonly pointsLost: number;
  };
}
```

---

## 8. Archetype Classification

The `totalScore` determines the user's archetype according to non-overlapping thresholds:

```
[ 0 ────────────── 39 ] [ 40 ──────── 59 ] [ 60 ──────── 74 ] [ 75 ──────── 89 ] [ 90 ──────── 100 ]
        COOKED                ZOMBIE              RECOVERING          SLEEPMAXXED            ELITE
```

| Score Range | Archetype ID (`id`) | Display Label (`label`) | Archetype Characterization |
| :---: | :--- | :--- | :--- |
| **0 – 39** | `"cooked"` | `COOKED` | Critically dysregulated routine. Severe recovery deficit. |
| **40 – 59** | `"zombie"` | `ZOMBIE` | Chronic routine debt. Sub-baseline daytime focus. |
| **60 – 74** | `"recovering"` | `RECOVERING` | Moderate stability with 1–2 pronounced routine leaks. |
| **75 – 89** | `"sleepmaxxed"` | `SLEEPMAXXED` | Disciplined routine. Upper-quartile hygiene habits. |
| **90 – 100** | `"elite"` | `ELITE` | Mastered circadian hygiene. Top 1% routine alignment. |

---

## 9. Biggest Weakness Calculation & Tie-Breaking

### 9.1 Point Loss Formula
For each category $c \in \{\text{duration}, \text{consistency}, \text{caffeine}, \text{screen}, \text{morningLight}\}$:
$$\text{pointsLost}_c = \text{max}_c - \text{earned}_c$$

### 9.2 Strict Tie-Breaking Order
When multiple categories share the exact same maximum lost points, the tie is broken strictly in favor of the earlier category in `WEAKNESS_PRIORITY`:

```typescript
export const WEAKNESS_PRIORITY: readonly SleepmaxxCategory[] = [
  "duration",     // Priority 1 (highest weight: 35 pts)
  "consistency",  // Priority 2 (weight: 25 pts)
  "caffeine",     // Priority 3 (weight: 20 pts)
  "screen",       // Priority 4 (weight: 10 pts)
  "morningLight", // Priority 5 (weight: 10 pts)
] as const;
```

**Implementation Invariant**:
A category only replaces the current candidate if its lost points are **strictly greater** (`lost > worst.pointsLost`). Equal lost points maintain the higher-priority category.

---

## 10. Input Validation & Edge-Case Behavior

The scoring engine employs direction-aware sanitizers to guarantee that invalid inputs never crash the application and always resolve to safe bounds:

### 10.1 Higher-is-Better Sanitizer (`safeNonNegative`)
* Used for: `sleepDurationHours`, `hoursSinceLastCaffeineBeforeBed`.
* Rule: If input is not finite (`isNaN(x) || !isFinite(x)`), return `0`. Clamps negative numbers to `0`.
* Consequence: `NaN` or `-5` results in `0` hours, awarding the minimum category points (**0 points**).

### 10.2 Higher-is-Worse Sanitizer (`safeHighIsWorse`)
* Used for: `weekendShiftHours`, `screenMinutesInBed`.
* Rule: If input is not finite (`isNaN(x) || !isFinite(x)`), return `Infinity`. Clamps negative numbers to `0`.
* Consequence: `NaN` or `Infinity` screen minutes maps to worst-case threshold ($\ge 60$ min), awarding **0 points** (preventing `0` screen minutes exploit).

### 10.3 Boundary Verification
* Exact boundary thresholds evaluate with strict `<` checks:
  * Duration `5.00h` awards **10 points**; `4.99h` awards **0 points**.
  * Consistency `1.00h` awards **17 points**; `0.99h` awards **22 points**.
  * Screen `15.00 min` awards **7 points**; `14.99 min` awards **9 points**.
  * Total score is guaranteed an integer $\in [0, 100]$.

---

## 11. Determinism & Immutability

1. **Deterministic Execution**: Same inputs always produce bit-for-bit identical `SleepmaxxResult`.
2. **Zero Side Effects**: Does not write to global variables, mutate function arguments, or perform asynchronous I/O.
3. **Input Immutability**: The input `QuizAnswers` object is treated as strictly read-only (`Object.freeze` compatible).

---

## 12. Test Coverage & Verification Contract

The implementation in [`src/core/scoringEngine.ts`](file:///home/hasashi/Bureau/SLEEPMAXX/src/core/scoringEngine.ts) is governed by [`src/core/scoringEngine.test.ts`](file:///home/hasashi/Bureau/SLEEPMAXX/src/core/scoringEngine.test.ts).

* **Current Status**: 77/77 tests passing.
* **Coverage Scope**:
  * Extreme bounds: Perfect routine ($100$), worst routine ($0$).
  * 17 duration variations across all boundaries.
  * 12 consistency variations including negative shift handling.
  * 11 caffeine variations including `null` and interval brackets.
  * 9 screen time variations.
  * 4 morning light discrete values.
  * 8 archetype boundary checks ($39/40$, $59/60$, $74/75$, $89/90$).
  * 4 tie-breaking order tests.
  * 7 invalid/non-finite input tests (`NaN`, `Infinity`, negative values).
  * Immutability and structural integrity assertions.

---

## 13. Change Control & Governance

1. **Spec Precedence**: This document is the formal contract for scoring logic.
2. **Modification Protocol**: Any proposed adjustment to category points, thresholds, archetypes, or sanitizers must:
   * First be drafted and approved in this specification.
   * Update corresponding tests in `src/core/scoringEngine.test.ts`.
   * Pass all automated regression gates (`vitest run`, `tsc -b`, `vite build`).
   * Preserve the 0–100 integer range invariant.
