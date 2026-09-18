import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createQuizStorage, STORAGE_KEY, STORAGE_VERSION } from './storage';
import type { QuizState } from './types';
import type { SleepmaxxResult } from '../../core/scoringEngine';

class MockStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

describe('QuizStorage Adapter', () => {
  let mockStorage: MockStorage;
  let storageAdapter: ReturnType<typeof createQuizStorage>;

  beforeEach(() => {
    mockStorage = new MockStorage();
    storageAdapter = createQuizStorage(mockStorage);
  });

  it('returns null when storage is empty', () => {
    expect(storageAdapter.loadSession()).toBeNull();
  });

  it('serializes and deserializes a valid in-progress session', () => {
    const state: QuizState = {
      step: 'question',
      questionIndex: 2,
      answers: {
        sleepDurationHours: 8.0,
        weekendShiftHours: 0.5,
      },
      result: null,
    };

    storageAdapter.saveSession(state);

    const raw = mockStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();

    const parsed = JSON.parse(raw!);
    expect(parsed.version).toBe(STORAGE_VERSION);
    expect(parsed.step).toBe('question');
    expect(parsed.questionIndex).toBe(2);
    expect(parsed.answers).toEqual({
      sleepDurationHours: 8.0,
      weekendShiftHours: 0.5,
    });
    expect(typeof parsed.updatedAt).toBe('number');

    const loaded = storageAdapter.loadSession();
    expect(loaded).toEqual(state);
  });

  it('serializes and deserializes a completed result session', () => {
    const mockResult: SleepmaxxResult = {
      totalScore: 85,
      categories: {
        duration: { earned: 35, max: 35, lost: 0 },
        consistency: { earned: 22, max: 25, lost: 3 },
        caffeine: { earned: 18, max: 20, lost: 2 },
        screen: { earned: 10, max: 10, lost: 0 },
        morningLight: { earned: 0, max: 10, lost: 10 },
      },
      archetype: {
        id: 'sleepmaxxed',
        label: 'SLEEPMAXXED',
      },
      biggestWeakness: {
        id: 'morningLight',
        label: 'Morning Sunlight',
        pointsLost: 10,
      },
    };

    const state: QuizState = {
      step: 'result',
      questionIndex: 4,
      answers: {
        sleepDurationHours: 8.0,
        weekendShiftHours: 0.5,
        hoursSinceLastCaffeineBeforeBed: 7.0,
        screenMinutesInBed: 0,
        morningLightFrequency: 'never',
      },
      result: mockResult,
    };

    storageAdapter.saveSession(state);
    const loaded = storageAdapter.loadSession();
    expect(loaded).toEqual(state);
  });

  it('safely recovers and returns null on corrupted JSON string', () => {
    mockStorage.setItem(STORAGE_KEY, '{invalid json syntax: missing closing brace');
    expect(storageAdapter.loadSession()).toBeNull();
  });

  it('returns null when schema version does not match', () => {
    const outdatedPayload = {
      version: 999,
      step: 'question',
      questionIndex: 1,
      answers: {},
      result: null,
      updatedAt: Date.now(),
    };

    mockStorage.setItem(STORAGE_KEY, JSON.stringify(outdatedPayload));
    expect(storageAdapter.loadSession()).toBeNull();
  });

  it('returns null on invalid step value', () => {
    const invalidPayload = {
      version: STORAGE_VERSION,
      step: 'unauthorized_step',
      questionIndex: 0,
      answers: {},
      result: null,
      updatedAt: Date.now(),
    };

    mockStorage.setItem(STORAGE_KEY, JSON.stringify(invalidPayload));
    expect(storageAdapter.loadSession()).toBeNull();
  });

  it('returns null on negative or out-of-bounds questionIndex', () => {
    const invalidPayloadNegative = {
      version: STORAGE_VERSION,
      step: 'question',
      questionIndex: -1,
      answers: {},
      result: null,
      updatedAt: Date.now(),
    };
    mockStorage.setItem(STORAGE_KEY, JSON.stringify(invalidPayloadNegative));
    expect(storageAdapter.loadSession()).toBeNull();

    const invalidPayloadHigh = {
      ...invalidPayloadNegative,
      questionIndex: 5,
    };
    mockStorage.setItem(STORAGE_KEY, JSON.stringify(invalidPayloadHigh));
    expect(storageAdapter.loadSession()).toBeNull();
  });

  it('returns null if answers object contains invalid fields or types', () => {
    const invalidAnswersPayload = {
      version: STORAGE_VERSION,
      step: 'question',
      questionIndex: 1,
      answers: {
        sleepDurationHours: 'not a number',
      },
      result: null,
      updatedAt: Date.now(),
    };
    mockStorage.setItem(STORAGE_KEY, JSON.stringify(invalidAnswersPayload));
    expect(storageAdapter.loadSession()).toBeNull();

    const unknownKeyPayload = {
      version: STORAGE_VERSION,
      step: 'question',
      questionIndex: 1,
      answers: {
        unknownHabitField: 42,
      },
      result: null,
      updatedAt: Date.now(),
    };
    mockStorage.setItem(STORAGE_KEY, JSON.stringify(unknownKeyPayload));
    expect(storageAdapter.loadSession()).toBeNull();

    const invalidLightPayload = {
      version: STORAGE_VERSION,
      step: 'question',
      questionIndex: 4,
      answers: {
        morningLightFrequency: 'extremely_often',
      },
      result: null,
      updatedAt: Date.now(),
    };
    mockStorage.setItem(STORAGE_KEY, JSON.stringify(invalidLightPayload));
    expect(storageAdapter.loadSession()).toBeNull();
  });

  it('clears session from storage on clearSession()', () => {
    const state: QuizState = {
      step: 'question',
      questionIndex: 1,
      answers: { sleepDurationHours: 7.0 },
      result: null,
    };

    storageAdapter.saveSession(state);
    expect(mockStorage.getItem(STORAGE_KEY)).not.toBeNull();

    storageAdapter.clearSession();
    expect(mockStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(storageAdapter.loadSession()).toBeNull();
  });

  it('handles backend throwing QuotaExceededError or SecurityError gracefully', () => {
    const faultyStorage: Storage = {
      length: 0,
      clear: vi.fn(),
      key: vi.fn(),
      getItem: vi.fn().mockImplementation(() => {
        throw new Error('SecurityError: Access is denied');
      }),
      setItem: vi.fn().mockImplementation(() => {
        throw new Error('QuotaExceededError');
      }),
      removeItem: vi.fn().mockImplementation(() => {
        throw new Error('SecurityError: Access is denied');
      }),
    };

    const faultyAdapter = createQuizStorage(faultyStorage);

    expect(() => faultyAdapter.saveSession({
      step: 'landing',
      questionIndex: 0,
      answers: {},
      result: null,
    })).not.toThrow();

    expect(() => faultyAdapter.loadSession()).not.toThrow();
    expect(faultyAdapter.loadSession()).toBeNull();

    expect(() => faultyAdapter.clearSession()).not.toThrow();
  });
});
