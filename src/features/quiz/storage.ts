import type { QuizAnswers, SleepmaxxResult, MorningLightFrequency } from '../../core/scoringEngine';
import type { QuizState, QuizStep, PersistedQuizSession } from './types';

export const STORAGE_KEY = 'sleepmaxx_quiz_session_v1';
export const STORAGE_VERSION = 1;

export interface QuizStorage {
  loadSession(): QuizState | null;
  saveSession(state: QuizState): void;
  clearSession(): void;
}

const VALID_STEPS: ReadonlySet<QuizStep> = new Set(['landing', 'question', 'result']);
const VALID_MORNING_LIGHT: ReadonlySet<MorningLightFrequency> = new Set([
  'almost_always',
  'often',
  'rarely',
  'never',
]);

const VALID_ANSWER_KEYS: ReadonlySet<keyof QuizAnswers> = new Set([
  'sleepDurationHours',
  'weekendShiftHours',
  'hoursSinceLastCaffeineBeforeBed',
  'screenMinutesInBed',
  'morningLightFrequency',
]);

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function isValidAnswers(answers: unknown): answers is Partial<QuizAnswers> {
  if (!isObject(answers)) return false;

  for (const key of Object.keys(answers)) {
    if (!VALID_ANSWER_KEYS.has(key as keyof QuizAnswers)) {
      return false;
    }
  }

  const ans = answers as Partial<QuizAnswers>;

  if (ans.sleepDurationHours !== undefined) {
    if (typeof ans.sleepDurationHours !== 'number' || !Number.isFinite(ans.sleepDurationHours)) {
      return false;
    }
  }

  if (ans.weekendShiftHours !== undefined) {
    if (typeof ans.weekendShiftHours !== 'number' || !Number.isFinite(ans.weekendShiftHours)) {
      return false;
    }
  }

  if (ans.hoursSinceLastCaffeineBeforeBed !== undefined && ans.hoursSinceLastCaffeineBeforeBed !== null) {
    if (
      typeof ans.hoursSinceLastCaffeineBeforeBed !== 'number' ||
      !Number.isFinite(ans.hoursSinceLastCaffeineBeforeBed)
    ) {
      return false;
    }
  }

  if (ans.screenMinutesInBed !== undefined) {
    if (typeof ans.screenMinutesInBed !== 'number' || !Number.isFinite(ans.screenMinutesInBed)) {
      return false;
    }
  }

  if (ans.morningLightFrequency !== undefined) {
    if (!VALID_MORNING_LIGHT.has(ans.morningLightFrequency)) {
      return false;
    }
  }

  return true;
}

function isValidResult(result: unknown): result is SleepmaxxResult | null {
  if (result === null) return true;
  if (!isObject(result)) return false;

  const res = result as Partial<SleepmaxxResult>;

  if (typeof res.totalScore !== 'number' || !Number.isFinite(res.totalScore)) {
    return false;
  }

  if (!isObject(res.categories)) return false;
  if (!isObject(res.archetype) || typeof res.archetype.id !== 'string') return false;
  if (!isObject(res.biggestWeakness) || typeof res.biggestWeakness.id !== 'string') return false;

  return true;
}

function validatePersistedPayload(payload: unknown): QuizState | null {
  if (!isObject(payload)) return null;

  if (payload.version !== STORAGE_VERSION) return null;

  if (typeof payload.step !== 'string' || !VALID_STEPS.has(payload.step as QuizStep)) {
    return null;
  }

  const step = payload.step as QuizStep;

  if (
    typeof payload.questionIndex !== 'number' ||
    !Number.isInteger(payload.questionIndex) ||
    payload.questionIndex < 0 ||
    payload.questionIndex > 4
  ) {
    return null;
  }

  if (!isValidAnswers(payload.answers)) return null;

  if (!isValidResult(payload.result)) return null;

  return {
    step,
    questionIndex: payload.questionIndex,
    answers: payload.answers,
    result: payload.result ?? null,
  };
}

function getSafeLocalStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // Return null if localStorage is inaccessible or blocked
  }
  return null;
}

export function createQuizStorage(customStorage?: Storage): QuizStorage {
  const getStorage = (): Storage | null => customStorage ?? getSafeLocalStorage();

  return {
    loadSession(): QuizState | null {
      try {
        const storage = getStorage();
        if (!storage) return null;

        const raw = storage.getItem(STORAGE_KEY);
        if (!raw) return null;

        const parsed = JSON.parse(raw);
        return validatePersistedPayload(parsed);
      } catch {
        // Silently discard parse error or read failure
        return null;
      }
    },

    saveSession(state: QuizState): void {
      try {
        const storage = getStorage();
        if (!storage) return;

        const payload: PersistedQuizSession = {
          version: STORAGE_VERSION,
          updatedAt: Date.now(),
          step: state.step,
          questionIndex: state.questionIndex,
          answers: state.answers,
          result: state.result ? (state.result as SleepmaxxResult) : null,
        };

        storage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch {
        // Silently ignore quota exceeded or write errors
      }
    },

    clearSession(): void {
      try {
        const storage = getStorage();
        if (!storage) return;
        storage.removeItem(STORAGE_KEY);
      } catch {
        // Silently ignore storage remove errors
      }
    },
  };
}

export const storage = createQuizStorage();
