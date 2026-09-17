// ─── Types ──────────────────────────────────────────────────────────

export type MorningLightFrequency = "almost_always" | "often" | "rarely" | "never";

export type SleepmaxxArchetype = "cooked" | "zombie" | "recovering" | "sleepmaxxed" | "elite";

export type SleepmaxxCategory = "duration" | "consistency" | "caffeine" | "screen" | "morningLight";

export interface QuizAnswers {
  readonly sleepDurationHours: number;
  readonly weekendShiftHours: number;
  readonly hoursSinceLastCaffeineBeforeBed: number | null;
  readonly screenMinutesInBed: number;
  readonly morningLightFrequency: MorningLightFrequency;
}

export interface CategoryResult {
  readonly earned: number;
  readonly max: number;
  readonly lost: number;
}

export interface SleepmaxxResult {
  readonly totalScore: number;
  readonly categories: {
    readonly duration: CategoryResult;
    readonly consistency: CategoryResult;
    readonly caffeine: CategoryResult;
    readonly screen: CategoryResult;
    readonly morningLight: CategoryResult;
  };
  readonly archetype: {
    readonly id: SleepmaxxArchetype;
    readonly label: string;
  };
  readonly biggestWeakness: {
    readonly id: SleepmaxxCategory;
    readonly label: string;
    readonly pointsLost: number;
  };
}

// ─── Constants ──────────────────────────────────────────────────────

const MAX_DURATION = 35;
const MAX_CONSISTENCY = 25;
const MAX_CAFFEINE = 20;
const MAX_SCREEN = 10;
const MAX_MORNING_LIGHT = 10;

const ARCHETYPE_LABELS: Record<SleepmaxxArchetype, string> = {
  cooked: "COOKED",
  zombie: "ZOMBIE",
  recovering: "RECOVERING",
  sleepmaxxed: "SLEEPMAXXED",
  elite: "ELITE",
};

const CATEGORY_LABELS: Record<SleepmaxxCategory, string> = {
  duration: "Sleep Duration",
  consistency: "Sleep Consistency",
  caffeine: "Caffeine Timing",
  screen: "Screen Habit",
  morningLight: "Morning Light",
};

// Deterministic tie-breaking priority (lower index = higher priority)
const WEAKNESS_PRIORITY: readonly SleepmaxxCategory[] = [
  "duration",
  "consistency",
  "caffeine",
  "screen",
  "morningLight",
] as const;

// ─── Input sanitization ─────────────────────────────────────────────

/** For metrics where higher value = better score. NaN/Infinity/negative → 0. */
function safeNonNegative(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

/** For metrics where higher value = worse score. NaN/Infinity → high value that triggers worst bucket. */
function safeHighIsWorse(value: number): number {
  if (!Number.isFinite(value)) return Infinity;
  return Math.max(0, value);
}

// ─── Category scorers ───────────────────────────────────────────────

function scoreDuration(hours: number): number {
  const h = safeNonNegative(hours);
  if (h < 5) return 0;
  if (h < 6) return 10;
  if (h < 7) return 22;
  if (h < 9) return 35;
  if (h < 10) return 33;
  return 30; // 10+
}

function scoreConsistency(shiftHours: number): number {
  const shift = safeHighIsWorse(Math.abs(shiftHours));
  if (shift === 0) return 25;
  if (shift < 1) return 22;
  if (shift < 2) return 17;
  if (shift < 3) return 10;
  return 0; // 3+
}

function scoreCaffeine(hoursBefore: number | null): number {
  if (hoursBefore === null) return 20;
  const h = safeNonNegative(hoursBefore);
  if (h >= 8) return 20;
  if (h >= 6) return 18;
  if (h >= 4) return 14;
  if (h >= 2) return 7;
  return 0; // <2
}

function scoreScreen(minutes: number): number {
  const m = safeHighIsWorse(minutes);
  if (m === 0) return 10;
  if (m < 15) return 9;
  if (m < 30) return 7;
  if (m < 60) return 4;
  return 0; // 60+
}

function scoreMorningLight(frequency: MorningLightFrequency): number {
  const scores: Record<MorningLightFrequency, number> = {
    almost_always: 10,
    often: 7,
    rarely: 3,
    never: 0,
  };
  return scores[frequency];
}

// ─── Archetype resolver ─────────────────────────────────────────────

function resolveArchetype(totalScore: number): SleepmaxxArchetype {
  if (totalScore >= 90) return "elite";
  if (totalScore >= 75) return "sleepmaxxed";
  if (totalScore >= 60) return "recovering";
  if (totalScore >= 40) return "zombie";
  return "cooked";
}

// ─── Main scoring function ──────────────────────────────────────────

export function calculateSleepmaxxScore(input: QuizAnswers): SleepmaxxResult {
  const durationEarned = scoreDuration(input.sleepDurationHours);
  const consistencyEarned = scoreConsistency(input.weekendShiftHours);
  const caffeineEarned = scoreCaffeine(input.hoursSinceLastCaffeineBeforeBed);
  const screenEarned = scoreScreen(input.screenMinutesInBed);
  const morningLightEarned = scoreMorningLight(input.morningLightFrequency);

  const totalScore = durationEarned + consistencyEarned + caffeineEarned + screenEarned + morningLightEarned;

  const categories = {
    duration: { earned: durationEarned, max: MAX_DURATION, lost: MAX_DURATION - durationEarned },
    consistency: { earned: consistencyEarned, max: MAX_CONSISTENCY, lost: MAX_CONSISTENCY - consistencyEarned },
    caffeine: { earned: caffeineEarned, max: MAX_CAFFEINE, lost: MAX_CAFFEINE - caffeineEarned },
    screen: { earned: screenEarned, max: MAX_SCREEN, lost: MAX_SCREEN - screenEarned },
    morningLight: { earned: morningLightEarned, max: MAX_MORNING_LIGHT, lost: MAX_MORNING_LIGHT - morningLightEarned },
  } as const;

  // Biggest weakness: highest point loss, ties broken by WEAKNESS_PRIORITY order
  const weakness = WEAKNESS_PRIORITY.reduce((worst, categoryId) => {
    const lost = categories[categoryId].lost;
    return lost > worst.pointsLost ? { id: categoryId, pointsLost: lost } : worst;
  }, { id: WEAKNESS_PRIORITY[0], pointsLost: categories[WEAKNESS_PRIORITY[0]].lost });

  const archetypeId = resolveArchetype(totalScore);

  return {
    totalScore,
    categories,
    archetype: {
      id: archetypeId,
      label: ARCHETYPE_LABELS[archetypeId],
    },
    biggestWeakness: {
      id: weakness.id,
      label: CATEGORY_LABELS[weakness.id],
      pointsLost: weakness.pointsLost,
    },
  };
}
