import { describe, it, expect } from "vitest";
import { calculateSleepmaxxScore, type QuizAnswers } from "./scoringEngine.ts";

// ─── Helpers ────────────────────────────────────────────────────────

/** Builds a perfect-routine input (100 points). Override specific fields as needed. */
function perfect(overrides: Partial<QuizAnswers> = {}): QuizAnswers {
  return {
    sleepDurationHours: 8,
    weekendShiftHours: 0,
    hoursSinceLastCaffeineBeforeBed: null,
    screenMinutesInBed: 0,
    morningLightFrequency: "almost_always",
    ...overrides,
  };
}

/** Builds a worst-routine input (0 points). */
function worst(overrides: Partial<QuizAnswers> = {}): QuizAnswers {
  return {
    sleepDurationHours: 4,
    weekendShiftHours: 4,
    hoursSinceLastCaffeineBeforeBed: 1,
    screenMinutesInBed: 120,
    morningLightFrequency: "never",
    ...overrides,
  };
}

// ─── Perfect & zero ─────────────────────────────────────────────────

describe("extreme scores", () => {
  it("perfect routine → 100", () => {
    const result = calculateSleepmaxxScore(perfect());
    expect(result.totalScore).toBe(100);
    expect(result.archetype.id).toBe("elite");
  });

  it("worst routine → 0", () => {
    const result = calculateSleepmaxxScore(worst());
    expect(result.totalScore).toBe(0);
    expect(result.archetype.id).toBe("cooked");
  });
});

// ─── Sleep Duration boundaries ──────────────────────────────────────

describe("sleep duration scoring", () => {
  const cases: [number, number][] = [
    [4, 0],
    [4.99, 0],
    [5, 10],
    [5.5, 10],
    [5.99, 10],
    [6, 22],
    [6.5, 22],
    [6.99, 22],
    [7, 35],
    [7.5, 35],
    [8, 35],
    [8.99, 35],
    [9, 33],
    [9.5, 33],
    [9.99, 33],
    [10, 30],
    [12, 30],
  ];

  it.each(cases)("%s hours → %i points", (hours, expected) => {
    const result = calculateSleepmaxxScore(perfect({ sleepDurationHours: hours }));
    expect(result.categories.duration.earned).toBe(expected);
  });
});

// ─── Consistency boundaries ─────────────────────────────────────────

describe("sleep consistency scoring", () => {
  const cases: [number, number][] = [
    [0, 25],
    [0.5, 22],
    [0.99, 22],
    [1, 17],
    [1.5, 17],
    [1.99, 17],
    [2, 10],
    [2.5, 10],
    [2.99, 10],
    [3, 0],
    [5, 0],
  ];

  it.each(cases)("shift %s hours → %i points", (shift, expected) => {
    const result = calculateSleepmaxxScore(perfect({ weekendShiftHours: shift }));
    expect(result.categories.consistency.earned).toBe(expected);
  });

  it("negative shift uses absolute value", () => {
    const result = calculateSleepmaxxScore(perfect({ weekendShiftHours: -2 }));
    expect(result.categories.consistency.earned).toBe(10);
  });
});

// ─── Caffeine boundaries ────────────────────────────────────────────

describe("caffeine timing scoring", () => {
  it("null (no caffeine) → 20", () => {
    const result = calculateSleepmaxxScore(perfect({ hoursSinceLastCaffeineBeforeBed: null }));
    expect(result.categories.caffeine.earned).toBe(20);
  });

  const cases: [number, number][] = [
    [10, 20],
    [8, 20],
    [7, 18],
    [6, 18],
    [5, 14],
    [4, 14],
    [3, 7],
    [2, 7],
    [1.5, 0],
    [0, 0],
  ];

  it.each(cases)("%s hours before bed → %i points", (hours, expected) => {
    const result = calculateSleepmaxxScore(perfect({ hoursSinceLastCaffeineBeforeBed: hours }));
    expect(result.categories.caffeine.earned).toBe(expected);
  });
});

// ─── Screen boundaries ──────────────────────────────────────────────

describe("screen habit scoring", () => {
  const cases: [number, number][] = [
    [0, 10],
    [1, 9],
    [14, 9],
    [15, 7],
    [29, 7],
    [30, 4],
    [59, 4],
    [60, 0],
    [120, 0],
  ];

  it.each(cases)("%s minutes → %i points", (minutes, expected) => {
    const result = calculateSleepmaxxScore(perfect({ screenMinutesInBed: minutes }));
    expect(result.categories.screen.earned).toBe(expected);
  });
});

// ─── Morning light ──────────────────────────────────────────────────

describe("morning light scoring", () => {
  const cases: [QuizAnswers["morningLightFrequency"], number][] = [
    ["almost_always", 10],
    ["often", 7],
    ["rarely", 3],
    ["never", 0],
  ];

  it.each(cases)("%s → %i points", (freq, expected) => {
    const result = calculateSleepmaxxScore(perfect({ morningLightFrequency: freq }));
    expect(result.categories.morningLight.earned).toBe(expected);
  });
});

// ─── Archetype boundaries ───────────────────────────────────────────

describe("archetype resolution", () => {
  // Build input that produces exactly the target total by manipulating duration/consistency
  // Perfect base without duration = 65 (consistency 25 + caffeine 20 + screen 10 + light 10)
  // Duration scores: 0, 10, 22, 35, 33, 30

  it("score 39 → cooked", () => {
    // 22 (duration 6h) + 17 (consistency 1h) + 0 (caffeine <2h) + 0 (screen 60m) + 0 (never)
    const result = calculateSleepmaxxScore({
      sleepDurationHours: 6,
      weekendShiftHours: 1,
      hoursSinceLastCaffeineBeforeBed: 0,
      screenMinutesInBed: 60,
      morningLightFrequency: "never",
    });
    expect(result.totalScore).toBe(39);
    expect(result.archetype.id).toBe("cooked");
  });

  it("score 40 → zombie", () => {
    // 22 (6h) + 17 (1h) + 0 (caffeine <2h) + 0 (screen 60m) + 0 (never) = 39 → need +1
    // 22 (6h) + 17 (1h) + 0 + 0 + 3 (rarely) = 42 — too high
    // 10 (5h) + 22 (0.5h) + 7 (2h caffeine) + 0 (60m) + 0 (never) = 39 + 1 = ... try:
    // 0 (4h) + 25 (0h) + 7 (3h caffeine) + 4 (30m) + 7 (often) = 43 — no
    // Exact: 10 (5h) + 22 (0.5h) + 7 (2h caffeine) + 0 (60m) + 0 (never) = 39 — not 40
    // 10 (5h) + 22 (0.5h) + 7 (2h caffeine) + 0 (60m) + 3 (rarely) = 42 
    // 10 (5h) + 17 (1h) + 7 (2h caffeine) + 0 (60m) + 3 (rarely) = 37 — no
    // 0 (4h) + 25 (0h) + 14 (4h caffeine) + 0 (60m) + 0 (never) = 39 — no
    // 0 + 25 + 14 + 0 + 3 = 42 too high
    // 0 + 25 + 7 + 4 + 7 = 43 too high
    // 22 + 17 + 0 + 0 + 3 = 42, 10 + 22 + 0 + 4 + 7 = 43, 
    // 22 + 10 + 0 + 4 + 7 = 43
    // Hard to hit exactly 40 with integer steps. Let me find combos:
    // 10 + 17 + 0 + 0 + 10 = 37 // no
    // 10 + 17 + 7 + 0 + 3 = 37 // no
    // 0 + 22 + 14 + 4 + 0 = 40 ← yes!
    const result = calculateSleepmaxxScore({
      sleepDurationHours: 4,
      weekendShiftHours: 0.5,
      hoursSinceLastCaffeineBeforeBed: 5,
      screenMinutesInBed: 45,
      morningLightFrequency: "never",
    });
    expect(result.totalScore).toBe(40);
    expect(result.archetype.id).toBe("zombie");
  });

  it("score 59 → zombie (upper bound)", () => {
    // 35 + 0 + 14 + 0 + 10 = 59 ← yes (8h sleep, 3h shift, 5h caffeine, 60m screen, always light)
    const result = calculateSleepmaxxScore({
      sleepDurationHours: 8,
      weekendShiftHours: 3,
      hoursSinceLastCaffeineBeforeBed: 5,
      screenMinutesInBed: 60,
      morningLightFrequency: "almost_always",
    });
    expect(result.totalScore).toBe(59);
    expect(result.archetype.id).toBe("zombie");
  });

  it("score 60 → recovering", () => {
    // 35 + 0 + 14 + 4 + 7 = 60 
    const result = calculateSleepmaxxScore({
      sleepDurationHours: 8,
      weekendShiftHours: 3,
      hoursSinceLastCaffeineBeforeBed: 5,
      screenMinutesInBed: 45,
      morningLightFrequency: "often",
    });
    expect(result.totalScore).toBe(60);
    expect(result.archetype.id).toBe("recovering");
  });

  it("score 74 → recovering (upper bound)", () => {
    // 35 + 17 + 14 + 4 + 7 = 77 — too high
    // 35 + 10 + 18 + 4 + 7 = 74 ← yes!
    const result = calculateSleepmaxxScore({
      sleepDurationHours: 8,
      weekendShiftHours: 2.5,
      hoursSinceLastCaffeineBeforeBed: 7,
      screenMinutesInBed: 40,
      morningLightFrequency: "often",
    });
    expect(result.totalScore).toBe(74);
    expect(result.archetype.id).toBe("recovering");
  });

  it("score 75 → sleepmaxxed", () => {
    // 35 + 10 + 18 + 4 + 10 = 77 — too high
    // 35 + 17 + 14 + 9 + 0 = 75 ← yes!
    const result = calculateSleepmaxxScore({
      sleepDurationHours: 8,
      weekendShiftHours: 1.5,
      hoursSinceLastCaffeineBeforeBed: 5,
      screenMinutesInBed: 5,
      morningLightFrequency: "never",
    });
    expect(result.totalScore).toBe(75);
    expect(result.archetype.id).toBe("sleepmaxxed");
  });

  it("score 89 → sleepmaxxed (upper bound)", () => {
    // 35 + 25 + 18 + 4 + 7 = 89 ← yes!
    const result = calculateSleepmaxxScore({
      sleepDurationHours: 8,
      weekendShiftHours: 0,
      hoursSinceLastCaffeineBeforeBed: 7,
      screenMinutesInBed: 45,
      morningLightFrequency: "often",
    });
    expect(result.totalScore).toBe(89);
    expect(result.archetype.id).toBe("sleepmaxxed");
  });

  it("score 90 → elite", () => {
    // 35 + 25 + 20 + 0 + 10 = 90 ← yes!
    const result = calculateSleepmaxxScore({
      sleepDurationHours: 8,
      weekendShiftHours: 0,
      hoursSinceLastCaffeineBeforeBed: null,
      screenMinutesInBed: 60,
      morningLightFrequency: "almost_always",
    });
    expect(result.totalScore).toBe(90);
    expect(result.archetype.id).toBe("elite");
  });
});

// ─── Biggest weakness ───────────────────────────────────────────────

describe("biggest weakness", () => {
  it("identifies duration as weakness when 0 points on duration", () => {
    const result = calculateSleepmaxxScore(perfect({ sleepDurationHours: 4 }));
    expect(result.biggestWeakness.id).toBe("duration");
    expect(result.biggestWeakness.pointsLost).toBe(35);
  });

  it("identifies screen when screen is only weakness", () => {
    const result = calculateSleepmaxxScore(perfect({ screenMinutesInBed: 60 }));
    expect(result.biggestWeakness.id).toBe("screen");
    expect(result.biggestWeakness.pointsLost).toBe(10);
  });

  it("tie-breaks by priority: duration before consistency", () => {
    // Both lose 25 points: duration 10/35 (lost 25) vs consistency 0/25 (lost 25)
    const result = calculateSleepmaxxScore(perfect({
      sleepDurationHours: 5,    // earns 10, loses 25
      weekendShiftHours: 4,     // earns 0, loses 25
    }));
    expect(result.biggestWeakness.id).toBe("duration");
    expect(result.biggestWeakness.pointsLost).toBe(25);
  });

  it("tie-breaks: caffeine before screen when same loss", () => {
    // caffeine 10/20 lost 10, screen 0/10 lost 10
    const result = calculateSleepmaxxScore(perfect({
      hoursSinceLastCaffeineBeforeBed: 5, // earns 14, loses 6
      screenMinutesInBed: 60,             // earns 0, loses 10
      morningLightFrequency: "never",     // earns 0, loses 10
    }));
    // screen and morningLight both lose 10, screen has higher priority
    expect(result.biggestWeakness.id).toBe("screen");
  });
});

// ─── Invalid inputs ─────────────────────────────────────────────────

describe("invalid input handling", () => {
  it("NaN sleepDuration → 0 points for duration", () => {
    const result = calculateSleepmaxxScore(perfect({ sleepDurationHours: NaN }));
    expect(result.categories.duration.earned).toBe(0);
    expect(Number.isFinite(result.totalScore)).toBe(true);
  });

  it("Infinity screenMinutes → 0 points for screen", () => {
    const result = calculateSleepmaxxScore(perfect({ screenMinutesInBed: Infinity }));
    expect(result.categories.screen.earned).toBe(0);
  });

  it("negative sleepDuration → 0 points", () => {
    const result = calculateSleepmaxxScore(perfect({ sleepDurationHours: -3 }));
    expect(result.categories.duration.earned).toBe(0);
  });

  it("negative caffeine hours → 0 points", () => {
    const result = calculateSleepmaxxScore(perfect({ hoursSinceLastCaffeineBeforeBed: -5 }));
    expect(result.categories.caffeine.earned).toBe(0);
  });

  it("NaN weekendShift → treated as worst case → 0 points", () => {
    const result = calculateSleepmaxxScore(perfect({ weekendShiftHours: NaN }));
    expect(result.categories.consistency.earned).toBe(0);
  });

  it("total score is always an integer", () => {
    const result = calculateSleepmaxxScore(perfect());
    expect(Number.isInteger(result.totalScore)).toBe(true);
  });

  it("total score is between 0 and 100", () => {
    const worstResult = calculateSleepmaxxScore(worst());
    const bestResult = calculateSleepmaxxScore(perfect());
    expect(worstResult.totalScore).toBeGreaterThanOrEqual(0);
    expect(worstResult.totalScore).toBeLessThanOrEqual(100);
    expect(bestResult.totalScore).toBeGreaterThanOrEqual(0);
    expect(bestResult.totalScore).toBeLessThanOrEqual(100);
  });
});

// ─── Immutability ───────────────────────────────────────────────────

describe("input immutability", () => {
  it("does not mutate the input object", () => {
    const input: QuizAnswers = {
      sleepDurationHours: 7,
      weekendShiftHours: 1,
      hoursSinceLastCaffeineBeforeBed: 6,
      screenMinutesInBed: 20,
      morningLightFrequency: "often",
    };
    const snapshot = JSON.stringify(input);
    calculateSleepmaxxScore(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});

// ─── Result structure ───────────────────────────────────────────────

describe("result structure", () => {
  it("contains all required fields", () => {
    const result = calculateSleepmaxxScore(perfect());
    expect(result).toHaveProperty("totalScore");
    expect(result).toHaveProperty("categories.duration");
    expect(result).toHaveProperty("categories.consistency");
    expect(result).toHaveProperty("categories.caffeine");
    expect(result).toHaveProperty("categories.screen");
    expect(result).toHaveProperty("categories.morningLight");
    expect(result).toHaveProperty("archetype.id");
    expect(result).toHaveProperty("archetype.label");
    expect(result).toHaveProperty("biggestWeakness.id");
    expect(result).toHaveProperty("biggestWeakness.label");
    expect(result).toHaveProperty("biggestWeakness.pointsLost");
  });

  it("category lost = max - earned", () => {
    const result = calculateSleepmaxxScore(perfect({ sleepDurationHours: 6 }));
    expect(result.categories.duration.lost).toBe(
      result.categories.duration.max - result.categories.duration.earned
    );
  });
});
